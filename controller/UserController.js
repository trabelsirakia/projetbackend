const User = require("../models/users");


async function adduser (req, res) {
  try {
    console.log(req.body);
    const user = await new User(req.body);
    user.save();
    res.status(200).send("user created");
  } catch (err) {
    console.log(err);
  }
}


async function showalluser (req, res) {
  try {
    const user = await User.find();
    res.status(200).json(user);
  } catch (err) {
    console.log(err);
  }
}

async function showuser(req, res) {
  try {
    const user = await User.findById(req.params.id);
    res.status(200).json(user);
  } catch (err) {
    console.log(err);
  }
}


async function deleteuser (req, res) {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    res.status(200).send("user deleted ");
  } catch (err) {
    console.log(err);
  }
}

async function updateuser(req, res) {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.status(200).json(user);
  } catch (err) {
    console.log(err);
  }
}

module.exports={adduser,showalluser,showuser,deleteuser,updateuser}