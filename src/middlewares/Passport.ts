import * as bcrypt from 'bcrypt';
import * as passport from 'passport';
import { ExtractJwt, Strategy as JWTStrategy } from 'passport-jwt';
import { Strategy as GoogleStrategy, VerifyCallback } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { Strategy as LocalStrategy } from 'passport-local';
import { FACEBOOK, GOOGLE } from '../constants';
import { User } from '@prisma/client';
import prisma from '../infrastructure/prisma';
// import { registerEnv } from '../utils';
import { CustomFacebookInterface, CustomGoogleInterface, JWTPayload } from '../interfaces';
// registerEnv();

const userNotFoundMessage = { message: 'user not found.' };
const errorMessage = { message: 'something went wrong.' };
const passwordNoMatchMessage = { message: 'password does not match.' };
const successMessage = { message: 'logged In Successfully.' };

const googleStrategy = new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.HOST}/api/v1/auth/google/callback`,
  },
  async (_accessToken: string, _refreshToken: string, profile: any, done: VerifyCallback) => {
    /**
     * @handle incoming google profile data
     */
    const googleUser: CustomGoogleInterface = profile._json;
    // console.log(googleUser);

    /**
     * photos api documentation
     * https://developers.google.com/photos/library/guides/list
     */

    // console.log({ _accessToken });

    const userFoundWithEmail = await prisma.user.findUnique({
      where: { email: googleUser.email },
      include: {
        accounts: true,
      },
    });

    let user: User;
    if (userFoundWithEmail) {
      // user with email exists
      if (userFoundWithEmail.accounts.find((a) => a.provider_account_id === googleUser.sub && a.provider == GOOGLE)) {
        // user already linked his google with his account
        user = userFoundWithEmail;
      } else {
        // link user with googleId
        const updatedUser = await prisma.user.update({
          where: {
            email: googleUser.email,
          },
          data: {
            accounts: {
              create: {
                provider: GOOGLE,
                provider_account_id: googleUser.sub,
                type: GOOGLE,
              },
            },
          },
        });

        user = updatedUser;
      }
    } else {
      // create new account
      const newUser: User = await prisma.user.create({
        data: {
          email: googleUser.email,
          user_name: googleUser.name,
          avatar_url: googleUser.picture,
          profile: {
            create: {
              first_name: googleUser.given_name,
              last_name: googleUser.family_name,
            },
          },
          accounts: {
            create: {
              provider: GOOGLE,
              provider_account_id: googleUser.sub,
              type: GOOGLE,
            },
          },
        },
      });
      user = newUser;
    }

    await prisma.account.updateMany({
      where: {
        provider_account_id: googleUser.sub,
        provider: GOOGLE,
      },
      data: {
        access_token: _accessToken,
        refresh_token: _refreshToken,
      },
    });

    done(null, { ...user, googleAccessToken: _accessToken, googleRefreshToken: _refreshToken });
  },
);

const facebookStrategy = new FacebookStrategy(
  {
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: `${process.env.HOST}/api/v1/auth/facebook/callback`,
    profileFields: ['email', 'name', 'id', 'photos'],
  },
  async (_accessToken: string, _refreshToken: string, profile: any, done: VerifyCallback) => {
    /**
     * @handle incoming facebook profile data
     */
    const facebookUser: CustomFacebookInterface = profile._json;
    // console.log(facebookUser);

    const userFoundWithEmail = await prisma.user.findUnique({
      where: { email: facebookUser.email },
      include: {
        accounts: true,
      },
    });

    let user: User;
    if (userFoundWithEmail) {
      // user with email exists
      if (
        userFoundWithEmail.accounts.find((a) => a.provider_account_id === facebookUser.id && a.provider === FACEBOOK)
      ) {
        // user already linked his facebook with his account
        user = userFoundWithEmail;
      } else {
        // link user with facebook id
        const updatedUser = await prisma.user.update({
          where: { email: facebookUser.email },
          data: {
            accounts: {
              create: {
                provider: FACEBOOK,
                provider_account_id: facebookUser.id,
                type: FACEBOOK,
              },
            },
          },
        });

        user = updatedUser;
      }
    } else {
      // create new account
      const newUser: User = await prisma.user.create({
        data: {
          email: facebookUser.email,
          user_name: facebookUser.email,
          avatar_url: facebookUser.picture.data.url,
          profile: {
            create: {
              first_name: facebookUser.first_name,
              last_name: facebookUser.last_name,
            },
          },
          accounts: {
            create: {
              provider: FACEBOOK,
              provider_account_id: facebookUser.id,
              type: FACEBOOK,
            },
          },
        },
      });
      user = newUser;
    }

    await prisma.account.updateMany({
      where: {
        provider_account_id: facebookUser.id,
        provider: FACEBOOK,
      },
      data: {
        access_token: _accessToken,
        refresh_token: _refreshToken,
      },
    });

    done(null, { ...user, facebookAccessToken: _accessToken, facebookRefreshToken: _refreshToken });
  },
);

/** Passport configuration */
export default () => {
  passport.use(
    new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
      try {
        if (!email || email?.trim() === '') throw new Error();
        const user = await prisma.user.findUnique({
          where: {
            email,
          },
        });
        if (!user) {
          return done(userNotFoundMessage, false, userNotFoundMessage);
        } else {
          const doesPasswordMatch = await bcrypt.compare(password, user.password);
          if (!doesPasswordMatch) {
            return done(passwordNoMatchMessage, false, passwordNoMatchMessage);
          }
        }
        return done(null, user, successMessage);
      } catch (err) {
        console.log(err);
        return done(errorMessage, false);
      }
    }),
  );

  passport.use(
    new JWTStrategy(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: process.env.JWT_SECRET,
      },
      async (jwtPayload: JWTPayload, done) => {
        try {
          // console.log('jwtPayload', jwtPayload);
          const user = await prisma.user.findUnique({
            where: {
              id: jwtPayload.id,
            },
          });
          return done(null, user);
          // return done(null, { id: 1, email: 'test@test.com' });
        } catch (err) {
          return done(err);
        }
      },
    ),
  );

  passport.serializeUser((user: User, done) => {
    console.log('serializeUser:', user);
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    console.log('deserializeUser:', id);

    const user = await prisma.user.findUnique({
      where: {
        id,
      },
    });
    done(null, user);
  });

  // google oauth2
  passport.use(googleStrategy);
  // refresh.use(googleStrategy);
  passport.use(facebookStrategy);
  // refresh.use(facebookStrategy as Strategy);
};
