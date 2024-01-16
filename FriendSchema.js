const mongoose = require("mongoose");
const Schema = mongoose.Schema;


let friendSchema = Schema({
  requestFROM: String,
  requestTO: String,
  currentstatus: {
    type: Number,
    enums: [
      0, //Request
      1, //Add
      2, //Reject => Delete this
    ]
  }

})

module.exports = mongoose.model('Friend', friendSchema);
