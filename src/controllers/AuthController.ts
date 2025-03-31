import { User } from '@prisma/client';
import passport from 'passport';

import bcrypt from 'bcrypt';
import { NextFunction, Request, Response, Router } from 'express';
import { PasswordSaltRound } from '../constants';
import HttpException from '../utils/HttpException';
import prisma from '../infrastructure/prisma';
import { JwtService } from '../services/jwt';
import { JWTPayload } from '../interfaces';
import jwt from 'jsonwebtoken';
import { UserLoginDTO, UserSignupDTO } from '../interfaces/User';
import logger from '../utils/Logger';
/**
 * BindingType controller
 *
 * @author Munkhjin
 * @createdDate 01/04/2020
 */
export class AuthController {
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

  public static async signup(req: Request<{}, {}, UserSignupDTO>, res: Response) {
    try {
      const { email, password } = req.body;

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create new user
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
        },
      });

      // Generate JWT token
      const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET!,
        { expiresIn: '24h' }
      );

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;

      return res.status(201).json({
        message: 'User created successfully',
        user: userWithoutPassword,
        token,
      });
    } catch (error) {
      logger.error('Signup error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }

  public static async login(req: Request<{}, {}, UserLoginDTO>, res: Response) {
    try {
      const { email, password } = req.body;
      logger.info('Login request received:', { email, password });
      logger.info(`JWT_SECRET: ${process.env.JWT_SECRET}`);

      // Find user
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Check password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid password' });
      }

      // Generate JWT token
      const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET!,
        { expiresIn: '24h' }
      );

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;

      return res.status(200).json({
        message: 'Login successful',
        user: userWithoutPassword,
        token,
      });
    } catch (error) {
      logger.error('Login error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }

  public static async me(req: Request, res: Response) {
    try {
      const user = req.user as User;
      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;

      return res.status(200).json({
        user: userWithoutPassword,
      });
    } catch (error) {
      logger.error('Me error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
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
  router.post('/signup', AuthController.signup);
  router.post('/login', AuthController.login);
  router.get('/me', AuthController.me);

  // google oauth endpoints

  return router;
};
