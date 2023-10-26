import prisma from '../infrastructure/prisma';
import { Request } from 'express';
import passport = require('passport');
import { AppResponse } from '../interfaces';
import redisService from '../services/redis';
import { AppRouter } from './AppRouter';

class NavigationController {
  public async getCountryPhoneNumberPrefix(_: Request, res: AppResponse) {
    const country_phone_number_prefix = await redisService.getCountryPhoneNumberPrefixes();
    res.sendSuccess(country_phone_number_prefix);

  }

  public async getCuisines(_: Request, res: AppResponse) {
    const cuisines = await prisma.cuisine.findMany();
    res.sendSuccess(cuisines);

  }

  public async getIngredients(_: Request, res: AppResponse) {
    const ingredients = await prisma.ingredient.findMany();
    res.sendSuccess(ingredients);

  }
  public async getOccassions(_: Request, res: AppResponse) {
    const occassions = await prisma.occasion.findMany();
    res.sendSuccess(occassions);

  }

  public async getAddons(_: Request, res: AppResponse) {
    const addons = await prisma.addOn.findMany();
    res.sendSuccess(addons);

  }

  public async getServings(_: Request, res: AppResponse) {
    const servings = await prisma.servingStyle.findMany();
    res.sendSuccess(servings);

  }
  public async getChefTypes(_: Request, res: AppResponse) {
    const chefTypes = await prisma.chefType.findMany();
    res.sendSuccess(chefTypes);
  }
  public async getSittingStyles(_: Request, res: AppResponse) {
    const sittingStyles = await prisma.sittingStyle.findMany();
    res.sendSuccess(sittingStyles);
  }
}

export default () => {
  const controller = new NavigationController();
  const router = new AppRouter();
  router.get('/country-phone-number-prefix', controller.getCountryPhoneNumberPrefix);
  router.router.use(passport.authenticate('jwt', { session: false }));
  router.get('/cuisine', controller.getCuisines);
  router.get('/ingredient', controller.getIngredients);
  router.get('/occassion', controller.getOccassions);
  router.get('/addon', controller.getAddons);
  router.get('/serving-style', controller.getServings);
  router.get('/chef-type', controller.getChefTypes);
  router.get('/sitting-style', controller.getSittingStyles);

  return router.router;
};
