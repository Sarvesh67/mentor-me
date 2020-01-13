const { google } = require('googleapis')
const router = require('express').Router()
const jwt = require('jsonwebtoken')
const User = require('../models/User')

// Set up appropriate env variables before deploying
const CLIENT_ID = process.env.CLIENT_ID
const CLIENT_SECRET = process.env.CLIENT_SECRET
const REDIRECT_URL = process.env.REDIRECT_URL

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL)

// Scope of data of user to access
const defaultScope = ['profile', 'email']

// @route   GET api/login/google/
// @desc    route for google Oauth 2 login
router.get('/', async (req, res) => {
  // Generate an OAuth URL and redirect there
  const url = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: defaultScope
  })
  res.redirect(url)
})

// @route   GET api/login/google/auth/google/callback
// @desc    route for getting user data and redirecting to dashboard
router.get('/auth/google/callback', function (req, res) {
  // get code from redirect url
  const code = req.query.code
  if (code) {
    // Get an access token based on our OAuth code
    oAuth2Client.getToken(code, async function (err, tokens) {
      if (err) {
        res.json('Error authenticating')
      } else {
        console.log('Successfully authenticated')
        oAuth2Client.setCredentials(tokens)
        const people = google.people({ version: 'v1', auth: oAuth2Client })
        const me = await people.people.get({
          auth: oAuth2Client,
          resourceName: 'people/me',
          personFields: 'names,emailAddresses'
        })

        const userName = me.data.names[0].displayName
        const userEmail = me.data.emailAddresses[0].value

        const emailExist = await User.findOne({
          email: userEmail.toLowerCase()
        })

        // Create a user in database if user does not exist already
        if (!emailExist) {
          // Create a new user
          const user = new User({
            name: userName,
            email: userEmail.toLowerCase(),
            password: 'googleauthenticated'
          })
          try {
            await user.save()
          } catch (err) {
            res.status(400).json({ error: err })
          }
        }

        // Now get that user's id
        const user = await User.findOne({
          email: userEmail.toLowerCase()
        })

        // Create and assign a token
        const TOKEN_SECRET = process.env.TOKEN_SECRET
        const token = jwt.sign({ _id: user._id }, TOKEN_SECRET)
        res.json({
          userId: user._id,
          'auth-token': token
        })
      }
    })
  }
})

module.exports = router
