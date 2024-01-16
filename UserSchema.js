const mongoose = require("mongoose");
const Schema = mongoose.Schema;

let userSchema = Schema({
  username: {
    type: String,
    unique: true,
    required: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
  },
  cards: {
    type: Array,
    require: true,
  },


});

module.exports = mongoose.model('User', userSchema);
