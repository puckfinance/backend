import { User } from '@prisma/client';
import prisma from '../infrastructure/prisma';

export namespace AuthRepository {
  export const findUserById = async (id: string): Promise<User | undefined> => {
    return await prisma.user.findUnique({
      where: {
        id,
      },
    });
  };
  export const verifyPhoneNumber = async (id: string) => {
    return await prisma.user.update({
      where: {
        id,
      },
      data: {
        phone_number_verified: true
      }
    })
  }

  export const findUserByPhoneNumber = async (phoneNumber: string): Promise<User | undefined> => {
    return await prisma.user.findUnique({
      where: {
        phone_number: phoneNumber,
      },
    });
  };

  export const findUserByEmail = async (email: string): Promise<User | undefined> => {
    return await prisma.user.findUnique({
      where: {
        email: email,
      },
    });
  };

  export const createUser = async ({
    email,
    name,
    picture,
    provider,
    providerId,
    accessToken,
  }: {
    email: string;
    name: string;
    picture: string;
    provider: string;
    providerId: string;
    accessToken: string;
  }): Promise<User> => {
    return await prisma.user.create({
      data: {
        email: email,
        user_name: name,
        avatar_url: picture,
        email_verified: true,
        accounts: {
          create: {
            provider: provider,
            type: provider,
            provider_account_id: providerId,
            access_token: accessToken,
          },
        },
        profile: {
          create: {
            first_name: name.split(' ')[0],
            last_name: name.split(' ').slice(1).join(' '),
          },
        },
      },
    });
  };
}
