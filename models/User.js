import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true,
    unique: true
  },
  points: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

const UserModel = mongoose.models.User || mongoose.model('User', UserSchema);

const isMongoActive = () => {
  const hasUri = !!(process.env.MONGO_URI || process.env.MONGODB_URI);
  const state = mongoose.connection.readyState;
  return hasUri || state === 1 || state === 2;
};

// Memory database fallback to support fully functional in-browser previewing when no MongoDB is active
const localUsersDb = [];

export const User = {
  schema: UserSchema,
  rawModel: UserModel,

  async create(data) {
    if (isMongoActive()) {
      return await UserModel.create(data);
    } else {
      const idStr = new mongoose.Types.ObjectId().toString();
      const record = {
        _id: idStr,
        id: idStr,
        name: data.name,
        phone: data.phone,
        points: data.points ?? 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        save: async function() {
          const idx = localUsersDb.findIndex(item => item._id === this._id);
          if (idx !== -1) {
            this.updatedAt = new Date();
            localUsersDb[idx] = { ...this };
          }
          return this;
        }
      };
      localUsersDb.push(record);
      return record;
    }
  },

  async findOne(query) {
    if (isMongoActive()) {
      return await UserModel.findOne(query);
    } else {
      const found = localUsersDb.find(item => {
        return Object.keys(query).every(key => item[key] === query[key]);
      });
      if (found) {
        return {
          ...found,
          save: async function() {
            const idx = localUsersDb.findIndex(item => item._id === this._id);
            if (idx !== -1) {
              this.updatedAt = new Date();
              localUsersDb[idx] = { ...this };
            }
            return this;
          }
        };
      }
      return null;
    }
  },

  async findById(id) {
    if (isMongoActive()) {
      return await UserModel.findById(id);
    } else {
      return await this.findOne({ _id: id });
    }
  },

  async find(query = {}) {
    if (isMongoActive()) {
      return await UserModel.find(query);
    } else {
      let results = [...localUsersDb];
      if (Object.keys(query).length > 0) {
        results = results.filter(item => {
          return Object.keys(query).every(key => {
            const criteria = query[key];
            if (criteria && typeof criteria === 'object' && criteria.$ne !== undefined) {
              return item[key] !== criteria.$ne;
            }
            return item[key] === criteria;
          });
        });
      }

      const createChainable = (data) => {
        const promise = Promise.resolve([...data]);
        promise.sort = function(sortOptions) {
          const sorted = [...data];
          if (sortOptions && typeof sortOptions === 'object') {
            const [sortKey, sortDir] = Object.entries(sortOptions)[0] || [];
            if (sortKey) {
              const dir = sortDir === -1 || sortDir === 'desc' ? -1 : 1;
              sorted.sort((a, b) => {
                const valA = a[sortKey] instanceof Date ? a[sortKey].getTime() : (a[sortKey] ?? 0);
                const valB = b[sortKey] instanceof Date ? b[sortKey].getTime() : (b[sortKey] ?? 0);
                if (valA < valB) return -1 * dir;
                if (valA > valB) return 1 * dir;
                return 0;
              });
            }
          }
          return createChainable(sorted);
        };
        promise.limit = function(num) {
          const limited = data.slice(0, Number(num));
          return createChainable(limited);
        };
        promise.lean = function() {
          return createChainable(data.map(d => ({ ...d })));
        };
        return promise;
      };

      return createChainable(results);
    }
  },

  async updateOne(query, update) {
    if (isMongoActive()) {
      return await UserModel.updateOne(query, update);
    } else {
      const records = await this.find(query);
      for (const record of records) {
        const idx = localUsersDb.findIndex(item => item._id === record._id);
        if (idx !== -1) {
          let updatedRecord = { ...localUsersDb[idx] };
          if (update.$set) {
            updatedRecord = {
              ...updatedRecord,
              ...update.$set
            };
          }
          if (update.$inc) {
            for (const key of Object.keys(update.$inc)) {
              updatedRecord[key] = (updatedRecord[key] || 0) + Number(update.$inc[key]);
            }
          }
          updatedRecord.updatedAt = new Date();
          localUsersDb[idx] = updatedRecord;
        }
      }
      return { nModified: records.length, n: records.length, ok: 1 };
    }
  },

  async findOneAndUpdate(query, update, options = {}) {
    if (isMongoActive()) {
      return await UserModel.findOneAndUpdate(query, update, options);
    } else {
      let found = localUsersDb.find(item => {
        return Object.keys(query).every(key => item[key] === query[key]);
      });

      if (!found && options.upsert) {
        // Upsert behaviour
        const phoneVal = query.phone || (update.$set && update.$set.phone) || update.phone;
        const nameVal = (update.$set && update.$set.name) || update.name || "Default Name";
        const pointsVal = (update.$set && update.$set.points) || update.points || 0;
        
        found = await this.create({
          phone: phoneVal,
          name: nameVal,
          points: pointsVal
        });
      }

      if (found) {
        const idx = localUsersDb.findIndex(item => item._id === found._id);
        if (idx !== -1) {
          let updatedRecord = { ...localUsersDb[idx] };
          
          // Apply top-level dynamic keys or Mongoose operators
          if (update.$set) {
            updatedRecord = { ...updatedRecord, ...update.$set };
          }
          if (update.$inc) {
            for (const key of Object.keys(update.$inc)) {
              updatedRecord[key] = (updatedRecord[key] || 0) + Number(update.$inc[key]);
            }
          }
          
          // Apply any flat keys if update is not operator-based
          for (const key of Object.keys(update)) {
            if (!key.startsWith('$')) {
              updatedRecord[key] = update[key];
            }
          }

          updatedRecord.updatedAt = new Date();
          localUsersDb[idx] = updatedRecord;
          return updatedRecord;
        }
      }
      return null;
    }
  },

  async findByIdAndUpdate(id, update, options = {}) {
    if (isMongoActive()) {
      return await UserModel.findByIdAndUpdate(id, update, options);
    } else {
      return this.findOneAndUpdate({ _id: id }, update, options);
    }
  }
};

export default User;
