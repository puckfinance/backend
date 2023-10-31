import { User } from '@prisma/client';
import * as passport from 'passport';

import * as bcrypt from 'bcrypt';
import { NextFunction, Request, Response, Router } from 'express';
import { PasswordSaltRound } from '../constants';
import { emailIsValid } from '../utils/EmailValidator';
import HttpException from '../utils/HttpException';
import prisma from '../infrastructure/prisma';
import { JwtService } from '../services/jwt';
import { JWTPayload } from '../interfaces';
/**
 * BindingType controller
 *
 * @author Munkhjin
 * @createdDate 01/04/2020
 */
class AuthController {
  public async signin(req: Request, res: Response) {
    if (!req.user) throw new Error('user empty.');
    const user = req.user as User;
    const payload: JWTPayload = {
      id: user.id,
      email: user.email,
    };

    const token = JwtService.generateToken(payload);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  }

  public async signup(req: Request, res: Response) {
    if (!req) throw new HttpException(400, 'email is empty.');
    if (!emailIsValid(req.body.email)) throw new HttpException(400, 'email is not valid.');

    const hashedPassword = await bcrypt.hash(req.body.password, PasswordSaltRound);
    req.body.password = hashedPassword;
    delete req.body.confirmPassword;

    const newUser = await prisma.user.create({
      data: req.body,
    });
    res.json({
      user: newUser,
    });
  }

  // public async forgotPassword(req: Request, res: Response) {
  //   if (!emailIsValid(req.body.email)) throw new HttpException(400, 'email is not valid.');

  //   const user = await AuthRepository.findUserByEmail(req.body.email);

  //   if (!user) throw new HttpException(400, 'user with email not found.');

  //   const passwordChangeToken = JwtService.generateVerificationToken({ id: user.id, email: user.email });

  //   // send token
  //   const response = await axios.post(`${process.env.EMAIL_API}/forgot-password`, {
  //     email: user.email,
  //     passwordChangeUrl: `${process.env.FRONTEND_URL}/auth/change-password?token=${passwordChangeToken}&email=${user.email}`,
  //   });

  //   if (response.status !== 200) throw new HttpException(400, 'error sending email.');

  //   // send token
  //   res.status(200).json({
  //     status: true,
  //     message: 'email sent.',
  //     data: null,
  //   });
  // }

  public async changePassword(req: Request, res: Response, _next: NextFunction) {
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
}

/**
 * BindingType routes
 *
 * @author Munkhjin
 * @createdDate 01/28/2020
 */
export default () => {
  const controller = new AuthController();
  const router = Router();
  router.post('/signin', passport.authenticate('local', { session: false }), controller.signin);
  router.post('/signup', controller.signup);

  // google oauth endpoints

  return router;
};
