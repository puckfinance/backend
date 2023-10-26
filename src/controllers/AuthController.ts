import { User } from '@prisma/client';
import * as passport from 'passport';

import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { NextFunction, Request } from 'express';
import { APPLE, FACEBOOK, GOOGLE, JWTExpire, PasswordSaltRound } from '../constants';
import { emailIsValid } from '../utils/EmailValidator';
import HttpException from '../utils/HttpException';
import { AppRequest, AppResponse, JWTPayload } from '../interfaces';
import { URL } from 'url';
import axios from 'axios';
import prisma from '../infrastructure/prisma';
import { JwtService } from '../services/jwtService';
import { AuthRepository } from '../repositories/AuthRepository';
import { TwilioService } from '../services/twilio';
import RedisService from '../services/redis';
import { AppRouter } from './AppRouter';
import { authInputSchema } from '../domain/inputs/authInputSchema';
/**
 * BindingType controller
 *
 * @author Munkhjin
 * @createdDate 01/04/2020
 */
class AuthController {
  public async sendOTP(req: AppRequest, res: AppResponse) {
    const { phone_number } = req.parseBody(authInputSchema)
    const user = await AuthRepository.findUserByPhoneNumber(phone_number);

    if (!user) throw new HttpException(400, 'user with email not found.');

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    //TODO: send otp to phonenumber
    if (process.env.NODE_ENV === 'production') {
      await TwilioService.sendVerificationCode(phone_number, otp);
      RedisService.setOtp(phone_number, otp);
    }

    res.status(200).json({
      status: true,
      message: 'otp sent',
    });

  }

  public async verifyOTP(req: AppRequest, res: AppResponse) {
    const { phone_number } = req.parseBody(authInputSchema)
    const user = await AuthRepository.findUserByPhoneNumber(phone_number);

    if (!user) throw new HttpException(400, 'user with email not found.');

    if (process.env.NODE_ENV == 'production') {
      var otp = await RedisService.getOtp(phone_number);
      //verify otp from request
      if (otp != req.body.otp) throw new HttpException(400, 'otp is not correct.');
    }

    await AuthRepository.verifyPhoneNumber(user.id)

    res.status(200).json({
      status: true,
      message: 'otp verified',
    });

  }

  public async signinWithOtp(req: AppRequest, res: AppResponse) {
    const { phone_number } = req.parseBody(authInputSchema)

    //verify otp
    //wrap otp validation in if statement to check if production environment 
    if (process.env.NODE_ENV === 'production') {
      var otp = await RedisService.getOtp(phone_number);
      if (otp !== req.body.otp) res.sendError(new HttpException(401, 'otp is not correct.'));
    }

    const existingUser = await AuthRepository.findUserByPhoneNumber(phone_number);
    var user = existingUser;
    if (!existingUser) {
      //create user
      const newUser = await prisma.user.create({
        data: {
          phone_number: phone_number,
        },
      });
      user = newUser;
    }

    const payload = {
      id: user.id,
      email: user.email,
    };

    const token = JwtService.generateToken(payload);
    delete user.password;
    res.sendSuccess({
      token: token,
      is_new: !existingUser,
      user: user,
    });

  }

  public async signin(req: AppRequest, res: AppResponse) {
    const user = req.user;

    const payload = {
      id: user.id,
      email: user.email,
    };

    const token = JwtService.generateToken(payload);
    delete user.password;
    res.sendSuccess({
      token,
      user: user,
    });
  }

  public async signinOrSignup(req: AppRequest, res: AppResponse) {
    const { email, password } = req.parseBody(authInputSchema);
    if (!emailIsValid(email)) throw new HttpException(400, 'email is not valid.');
    const user = await AuthRepository.findUserByEmail(email);
    if (!user) {
      const newUser = await prisma.user.create({
        data: {
          email,
          password,
        },
      });
      const payload = {
        id: newUser.id,
        email: newUser.email,
      };
      delete newUser.password;
      const token = JwtService.generateToken(payload);
      res.sendSuccess({
        token,
        is_new: true,
        user: newUser,
      });
    }
    else {
      const payload = {
        id: user.id,
        email: user.email,
      };
      const token = JwtService.generateToken(payload);
      delete user.password;
      res.sendSuccess({
        token,
        is_new: false,
        user: user,
      });
    }
  }

  public async signup(req: Request, res: AppResponse) {
    if (!req) throw new HttpException(400, 'email is empty.');
    if (!emailIsValid(req.body.email)) throw new HttpException(400, 'email is not valid.');

    const hashedPassword = await bcrypt.hash(req.body.password, PasswordSaltRound);
    req.body.password = hashedPassword;
    delete req.body.confirmPassword;

    const newUser = await prisma.user.create({
      data: req.body,
    });
    res.sendSuccess({
      user: newUser,
    });

  }

  public async forgotPassword(req: Request, res: AppResponse) {
    if (!emailIsValid(req.body.email)) throw new HttpException(400, 'email is not valid.');

    const user = await AuthRepository.findUserByEmail(req.body.email);

    if (!user) throw new HttpException(400, 'user with email not found.');

    const passwordChangeToken = JwtService.generateVerificationToken({ id: user.id, email: user.email });

    // send token
    const response = await axios.post(`${process.env.EMAIL_API}/forgot-password`, {
      email: user.email,
      passwordChangeUrl: `${process.env.FRONTEND_URL}/auth/change-password?token=${passwordChangeToken}&email=${user.email}`,
    });

    if (response.status !== 200) throw new HttpException(400, 'error sending email.');

    // send token
    res.status(200).json({
      status: true,
      message: 'email sent.',
      data: null,
    });
  }

  public async changePassword(req: Request, res: AppResponse, _next: NextFunction) {

    const token = req.params.token;
    const payload = JwtService.verifyToken(token) as Partial<User>;

    if (req.body.password.trim() === '' || req.body.password !== req.body.confirm_password)
      throw new HttpException(400, `passwords doesn't match.`);

    const hashedPassword = await bcrypt.hash(req.body.password, PasswordSaltRound);

    const updatedUser = await prisma.user.update({
      where: {
        id: payload.id,
      },
      data: {
        password: hashedPassword,
      },
    });

    if (!updatedUser) throw new HttpException(400, 'failed to change password.');

    res.status(200).json({
      status: true,
      message: 'successfully changed password.',
      data: null,
    });

  }

  public async sendVerificationEmail(req: AppRequest, res: AppResponse) {
    const user = req.user;
    const emailToken = JwtService.generateVerificationToken({ id: user.id, email: user.email });

    // send token
    const response = await axios.post(`${process.env.EMAIL_API}/user-confirm`, {
      email: user.email,
      confirmUrl: `${process.env.HOST}/api/v1/auth/verify-email/${emailToken}`,
    });

    if (response.status !== 200) throw new HttpException(400, 'error sending email.');

    res.status(200).json({
      status: true,
      message: 'email sent.',
      data: response.data,
    });

  }

  public async getCurrentUser(req: AppRequest, res: AppResponse) {
    delete req.user.password;
    const user = await AuthRepository.findUserById(req.user.id);

    res.status(200).json({
      status: true,
      message: 'okay',
      data: {
        user: user,
      },
    });

  }

  public async googleCallback(req: AppRequest, res: AppResponse) {
    const user = req.user as any;
    const payload: JWTPayload = {
      id: user.id,
      googleId: user.googleId,
    };

    const token = JwtService.generateToken(payload);

    const redirectUrl = new URL(
      `${process.env.FRONTEND_URL}/redirect?token=${token}&googleAccessToken=${user.googleAccessToken}&googleRefreshToken=${user.googleRefreshToken}`,
    );
    res.redirect(redirectUrl.toString());

  }

  public async facebookCallback(req: Request, res: AppResponse) {
    const user = req.user as any;
    const payload: JWTPayload = {
      id: user.id,
      facebookId: user.facebookId,
    };

    const token = JwtService.generateToken(payload);

    const redirectUrl = new URL(
      `${process.env.FRONTEND_URL}/redirect?token=${token}&facebookAccessToken=${user.facebookAccessToken}`,
    );
    res.redirect(redirectUrl.toString());
    // res.json(user);

  }

  public async loginWithGoogle(req: Request, res: AppResponse, _next: NextFunction) {
    var access_token = req.body.access_token;

    var resp = await axios.get('https://www.googleapis.com/oauth2/v1/userinfo', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const existingUser = await AuthRepository.findUserByEmail(resp.data.email);
    const user = existingUser
      ? existingUser
      : await AuthRepository.createUser({
        email: resp.data.email,
        name: resp.data.name,
        picture: resp.data.picture,
        providerId: resp.data.id,
        provider: GOOGLE,
        accessToken: access_token,
      });

    const payload: JWTPayload = {
      id: user.id,
      googleId: resp.data.id,
    };
    return res.status(200).json({
      status: true,
      message: 'successfully logged in.',
      data: {
        token: jwt.sign(payload, process.env.JWT_SECRET, {
          expiresIn: JWTExpire,
        }),
        user: user,
        is_new: !existingUser,
      },
    });

  }

  public async loginWithFacebook(req: Request, res: AppResponse, _next: NextFunction) {

    var access_token = req.body.access_token;

    var resp = await axios.get('https://graph.facebook.com/me?fields=id,name,email,picture', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const existingUser = await AuthRepository.findUserByEmail(resp.data.email);
    const user = existingUser
      ? existingUser
      : await AuthRepository.createUser({
        email: resp.data.email,
        name: resp.data.name,
        picture: resp.data.picture.data.url,
        providerId: resp.data.id,
        provider: FACEBOOK,
        accessToken: access_token,
      });

    const payload: JWTPayload = {
      id: user.id,
      facebookId: resp.data.id,
    };
    return res.status(200).json({
      status: true,
      message: 'successfully logged in.',
      data: {
        token: JwtService.generateToken(payload),
        user: user,
        is_new: !existingUser,
      },
    });

  }

  public async loginWithApple(req: Request, res: AppResponse, _next: NextFunction) {
    var access_token = req.body.access_token;

    const response = await axios.get(`https://api.apple.com/v1/me`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const existingUser = await AuthRepository.findUserByEmail(response.data.email);
    const user = existingUser
      ? existingUser
      : await AuthRepository.createUser({
        email: response.data.email,
        name: response.data.name,
        picture: response.data.picture,
        providerId: response.data.id,
        provider: APPLE,
        accessToken: access_token,
      });

    const payload: JWTPayload = {
      id: user.id,
      appleId: response.data.id,
    };
    return res.status(200).json({
      status: true,
      message: 'successfully logged in.',
      data: {
        token: JwtService.generateToken(payload),
        user: user,
        is_new: !existingUser,
      },
    });

  }
}

/**
 * BindingType routes
 *
 * @author Munkhjin
 * @createdDate 01/28/2020
 */
export default () => {
  const controller = new AuthController();
  const router = new AppRouter();
  router.post('/signin-or-up', controller.signinOrSignup)
  router.post('/signin', passport.authenticate('local', { session: false }), controller.signin);
  router.post('/signup', controller.signup);
  router.post('/signin-with-otp', controller.signinWithOtp);
  router.post('/otp/send', controller.sendOTP);
  router.post('/otp/verify', controller.verifyOTP);

  router.get('/user', passport.authenticate('jwt', { session: false }), controller.getCurrentUser);
  // google oauth endpoints
  router.get(
    '/google',
    passport.authenticate('google', {
      scope: ['profile', 'email'],
      accessType: 'offline',
      prompt: 'consent',
    }),
  );

  router.post('/google', controller.loginWithGoogle);

  router.get(
    '/google/callback',
    passport.authenticate('google', {
      session: false,
    }),
    controller.googleCallback,
  );
  router.get(
    '/facebook',
    passport.authenticate('facebook', {
      scope: ['email', 'public_profile', 'user_photos'],
    }),
  );
  router.post('/facebook', controller.loginWithFacebook);
  router.get('/facebook/callback', passport.authenticate('facebook', { session: false }), controller.facebookCallback);

  router.post('/apple', controller.loginWithApple);

  router.post('/forgot-password', controller.forgotPassword);
  router.post('/change-password/:token', controller.changePassword);
  router.get('/verify-email', passport.authenticate('jwt', { session: false }), controller.sendVerificationEmail);

  return router.router;
};




