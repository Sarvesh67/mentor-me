const { match } = require('../utils/match')
const Mentee = require('../models/menteeM')
const Mentor = require('../models/mentorM')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const google = require('../utils/googleAuthentication')

// This function sends the user data of the user logged in.
exports.dashboard = async (req, res) => {
  const userId = req.header('menteeId')
  if (!userId) return res.status(200).json({ success: false, msg: 'userId not provided' })
  try {
    const mentee = await Mentee.findById(userId)
    res.status(200).json({ success: true, mentors: mentee.mentors })
  } catch (err) {
    // console.log(err)
    res.status(200).json({ success: false, msg: 'User not found' })
  }
}

// This function finds a new mentor and sends it to front-end.
exports.newmentor = async (req, res) => {
  // Front end should pass appropriate data so as to find mentee whose mentor has to be found(Session)
  try {
    // Get mentorId from match function
    const mentorID = await match(req.body.skill)
    // console.log(mentorID)
    if (mentorID) {
      res.status(200).json({ success: true, mentorId: mentorID }) // Send back the mentorId to send notification to the mentor
    } else {
      res.status(200).json({ success: false, msg: 'Mentor not found' })
    }
  } catch (err) {
    res.status(200).json({ success: false, msg: 'Server error' })
  }
}

// This function deletes mentee account
exports.deleteacc = async (req, res) => {
  try {
    const mentee = await Mentee.findById(req.body.menteeId)
    console.log(mentee)
    if (mentee) {
      await Mentee.deleteOne({ _id: req.body.menteeId })
      return res.status(200).json({ success: true, msg: 'Mentee deleted' })
    } else {
      return res.status(200).json({ success: false, msg: 'Mentee not found' })
    }
  } catch (err) {
    console.log(err)
    return res.status(200).json({ success: false, msg: 'Server error' })
  }
}

exports.googlelogin = async (req, res) => {
  // get code from redirect url
  const code = req.query.code
  if (code) {
    const me = google.googleauth(code)

    if (!me) { return res.status(200).json({ success: false, msg: 'User not found' }) }

    const userName = me.data.names[0].displayName
    const userEmail = me.data.emailAddresses[0].value

    const emailExist = await Mentee.findOne({
      email: userEmail.toLowerCase()
    })

    // Create a user in database if user does not exist already
    if (!emailExist) {
      // Create a new user
      const user = new Mentee({
        name: userName,
        email: userEmail.toLowerCase(),
        password: 'googleauthenticated'
      })
      try {
        await user.save()
      } catch (err) {
        res.status(200).json({ success: false, msg: 'Server error. User not saved.' })
      }
    }

    // Now get that user's id
    const mentee = await Mentee.findOne({
      email: userEmail.toLowerCase()
    })

    const token = google.token(mentee)
    return res.status(200).json({
      success: true,
      userId: mentee._id,
      authToken: token,
      msg: 'Sign-in succesful!'
    })
  }
}

exports.googleandroidlogin = async (req, res) => {
  // get code from redirect url
  const code = req.query.code
  if (code) {
    const me = google.googleandroidauth(code)

    if (!me) { return res.status(200).json({ success: false, msg: 'User not found' }) }

    const userName = me.data.names[0].displayName
    const userEmail = me.data.emailAddresses[0].value

    const emailExist = await Mentee.findOne({
      email: userEmail.toLowerCase()
    })

    // Create a user in database if user does not exist already
    if (!emailExist) {
      // Create a new user
      const mentee = new Mentee({
        name: userName,
        email: userEmail.toLowerCase(),
        password: 'googleauthenticated'
      })
      try {
        await mentee.save()
      } catch (err) {
        res.status(200).json({ success: false, msg: 'Server error. User not saved.' })
      }
    }

    // Now get that user's id
    const mentee = await Mentee.findOne({
      email: userEmail.toLowerCase()
    })

    const token = google.token(mentee)
    return res.status(200).json({
      success: true,
      userId: mentee._id,
      authToken: token,
      msg: 'Sign-in succesful!'
    })
  }
}

const {
  emailValidation,
  nameValidation,
  passwordValidation
} = require('../utils/validation')

exports.register = async (req, res) => {
  // Validate the register data
  const erroremail = emailValidation(req.body)
  const errorname = nameValidation(req.body)
  const errorpassword = passwordValidation(req.body)

  if (erroremail) {
    return res.status(200).json({
      success: false,
      msg: 'The email field entered is either blank or not a valid email.'
    })
  }

  if (errorname) {
    return res.status(200).json({
      success: false,
      msg: 'The name field entered is incorrect. The name should be atleast 2 digits long'
    })
  }

  if (errorpassword) {
    return res.status(200).json({
      success: false,
      msg: 'The password field entered is incorrect. The password should be atleast 6 digits long.'
    })
  }

  // Check if user already exists
  const emailExist = await Mentee.findOne({
    email: req.body.email.toLowerCase()
  })
  // console.log(emailExist)
  if (emailExist) {
    return res.status(200).json({
      success: false,
      msg: 'Email already exists'
    })
  }

  // Hash passwords
  const salt = await bcrypt.genSalt()
  const hashedPassword = await bcrypt.hash(req.body.password, salt)

  // Create a new user
  const user = new Mentee({
    name: req.body.name,
    email: req.body.email.toLowerCase(),
    password: hashedPassword,
    skills: [],
    online: true,
    mentors: []
  })

  // console.log(user)
  try {
    await user.save()
    // Create and assign a token
    const TOKEN_SECRET = process.env.TOKEN_SECRET
    const token = jwt.sign({
      _id: user._id
    }, TOKEN_SECRET)
    return res.status(200).json({
      success: true,
      userId: user._id,
      authToken: token,
      msg: 'Registration succesful!'
    })
  } catch (err) {
    return res.status(200).json({
      success: false,
      msg: 'Registration unsuccesful.'
    })
  }
}

exports.login = async (req, res) => {
  // Validate the login data
  const erroremail = emailValidation(req.body)
  const errorpassword = passwordValidation(req.body)

  if (erroremail) {
    return res.status(200).json({
      success: false,
      msg: 'The email field entered is either blank or not a valid email.'
    })
  }

  if (errorpassword) {
    return res.status(200).json({
      success: false,
      msg: 'The password field entered is incorrect. The password should be atleast 6 digits long.'
    })
  }

  // Check if email exists
  const user = await Mentee.findOne({
    email: req.body.email.toLowerCase()
  })

  if (!user) {
    return res.status(200).json({
      success: false,
      msg: 'Email or the password is wrong'
    })
  }

  // Check if password is correct
  const validPass = await bcrypt.compare(req.body.password, user.password)
  if (!validPass) {
    return res.status(200).json({
      success: false,
      msg: 'Email or the password is wrong'
    })
  }

  // Create and assign a token
  try {
    user.online = true
    await user.save()
    // console.log(user)
    const TOKEN_SECRET = process.env.TOKEN_SECRET
    const token = jwt.sign({
      _id: user._id
    }, TOKEN_SECRET)
    res.status(200).json({
      success: true,
      userId: user._id,
      authToken: token,
      msg: 'Login succesful!'
    })
  } catch (err) {
    res.status(200).json('Login unsuccesful')
  }
}

// This function deletes mentee account
exports.getAllMentors = async (req, res) => {
  try {
    const mentee = await Mentee.findById(req.body.menteeId)
    // console.log(mentee)
    if (mentee) {
      var mentorids = mentee.mentors
      // console.log(mentorids)
      var currentMentorDetails = []
      for (var i in mentorids) {
        var mentorId = mentorids[i].mentorid
        var mentor = await Mentor.findById(mentorId)
        var createObj = {
          mentorId: mentor._id,
          mentorName: mentor.name
        }
        currentMentorDetails.push(createObj)
      }
      return res.status(200).json({ success: true, currentMentorDetails: currentMentorDetails })
    } else {
      return res.status(200).json({ success: false, msg: 'MenteeId is not valid' })
    }
  } catch (err) {
    console.log(err)
    return res.status(200).json({ success: false, msg: 'Server error' })
  }
}
