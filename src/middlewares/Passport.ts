import * as bcrypt from 'bcrypt';
import * as passport from 'passport';
import { ExtractJwt, Strategy as JWTStrategy } from 'passport-jwt';
import { Strategy as LocalStrategy } from 'passport-local';
import prisma from '../infrastructure/prisma';
import { JWTPayload } from '../interfaces';
const userNotFoundMessage = { message: 'user not found.' };
const errorMessage = { message: 'something went wrong.' };
const passwordNoMatchMessage = { message: 'password does not match.' };
const successMessage = { message: 'logged In Successfully.' };

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
          return done(null, user as any);
          // return done(null, { id: 1, email: 'test@test.com' });
        } catch (err) {
          return done(err);
        }
      },
    ),
  );

  passport.serializeUser((user: any, done) => {
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
};
