import { Request } from 'express';
import passport = require('passport');
import { bookEventSchema } from '../domain/inputs/bookEventSchema';
import { User } from '@prisma/client';
import { AppResponse, AppRequest } from '../interfaces';
import { convertBookEventSchemaToUpdateEventInput, convertBookEventSchemaToCreateEventInput, eventToBookEventSchema } from '../usecases/bookEvent';
import { EventBookingRepository } from '../repositories/EventBookingRepository';
import { AppRouter } from './AppRouter';

class BookingController {
  public async bookEvent(req: AppRequest, res: AppResponse) {
    const user = req.user as User;

    const booking = await EventBookingRepository.createEvent(convertBookEventSchemaToCreateEventInput(req.parseBody(bookEventSchema))(user.id));

    res.sendSuccess(booking);

  }

  public async getEvents(req: AppRequest, res: AppResponse) {
    const events = await EventBookingRepository.getEvents(req.user);
    res.sendSuccess(events.map(
      e => eventToBookEventSchema(e),
    ));

  }

  public async getEvent(req: Request, res: AppResponse) {
    const { id } = req.params;
    const event = await EventBookingRepository.getEvent(id);
    if (event === null) return res.sendError(404, "Event not found.");
    res.sendSuccess(
      eventToBookEventSchema(event)
    );

  }

  public async getUserActiveEvent(req: AppRequest, res: AppResponse) {

    const event = await EventBookingRepository.getUserActiveEvent(req.user.id);
    if (event === null) return res.sendError(404, "Event not found.");
    res.sendSuccess(
      eventToBookEventSchema(event)
    );
  }

  getMatchingChefs = async (req: Request, res: AppResponse) => {
    const { id } = req.params;
    const chefs = await EventBookingRepository.getMatchingChefs(id);

    res.sendSuccess(chefs);


  }

  updateEvent = async (req: AppRequest, res: AppResponse) => {
    const { id } = req.params;

    const event = await EventBookingRepository.updateEvent(id, convertBookEventSchemaToUpdateEventInput(req.parseBody(bookEventSchema)));

    res.sendSuccess(event);

  }

  updateChef = async (req: Request, res: AppResponse) => {
    const { id } = req.params;
    const { chef_id } = req.body;

    const event = await EventBookingRepository.updateChef(id, chef_id);

    res.sendSuccess(event);


  }


}

export default () => {
  const controller = new BookingController();
  const router = new AppRouter();
  router.router.use(passport.authenticate('jwt', { session: false }));
  router.post('/event', controller.bookEvent);
  router.put('/event/:id', controller.updateEvent);
  router.get('/events', controller.getEvents);
  router.get('/event/:id', controller.getEvent);
  router.get('/event/:id/matching-chefs', controller.getMatchingChefs);
  router.put('/event/:id/chef', controller.updateChef);
  router.get('/active-event', controller.getUserActiveEvent);

  return router.router;
};
