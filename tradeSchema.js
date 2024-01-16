const mongoose = require("mongoose");
const Schema = mongoose.Schema;


let tradeSchema = Schema({
  requestFROM: String,
  requestTO: String,
  cardOFFER: String,
  cardRECEIVE: String,
  currentstatus: {
    type: Number,
    enums: [
      0, //Request
      1, //Accept
      2, //Reject => Delete this
    ]
  }

})

module.exports = mongoose.model('Trade', tradeSchema);
