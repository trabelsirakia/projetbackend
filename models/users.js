const mongo=require('mongoose')
const schema=mongo.Schema
const User=new schema({
    name:String,
    cin:Number,
    email:String
})
module.exports=mongo.model('user',User)