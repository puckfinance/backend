import { NextFunction, Request } from 'express';
import { AppRequest, AppResponse } from '../interfaces';
import StripeService from '../services/stripe';
import passport = require('passport');
import { AppRouter } from './AppRouter';
import express = require('express');
import { EventBookingRepository } from '../repositories/EventBookingRepository';
import { calculateEventPrice } from '../usecases/bookEvent';
import { chargeEventBillSchema } from '../domain/schemas/chargeEventBillSchema';
import prisma from '../infrastructure/prisma';
import Stripe from 'stripe';

const endpointSecret = 'whsec_gHGGgOXwBSpg63LUFJPeNMZw1t0b7s37'

class PaymentController {

  webhookPayment = async (request: Request, response: AppResponse, _next: NextFunction): Promise<void> => {
    const sig = request.headers['stripe-signature'];

    let event = StripeService.constructEvent(request.body, sig as string, endpointSecret);
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    if (event.type.startsWith('payment_intent.')) {
      await prisma.transaction.create({
        data: {
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          amount_capturable: paymentIntent.amount_capturable,
          amount_received: paymentIntent.amount_received,
          description: paymentIntent.description || "",
          payment_method_types: paymentIntent.payment_method_types,
          status: paymentIntent.status,
          event_id: paymentIntent.metadata.event_id,
        }
      });
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        console.log('PaymentIntent was successful!', paymentIntent);

        break;
      case 'payment_method.attached':
        const paymentMethod = event.data.object;
        console.log('PaymentMethod was attached to a Customer!', paymentMethod);
        break;
      case 'payment_intent.created':
        const paymentIntentCreated = event.data.object;
        console.log('PaymentIntent was created!', paymentIntentCreated);
        break;
      // ... handle other event types
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    response.json({ received: true });
  };

  createOffSessionPaymentIntent = async (req: AppRequest, res: AppResponse, _next: NextFunction): Promise<void> => {
    const { items } = req.body;

    const customer = await StripeService.findCustomerByEmail(req.user.email);
    if (customer === null) {
      return res.sendError(404, 'Customer not found');
    }
    const cards = await StripeService.listCards(customer.id);
    if (cards.data.length === 0) {
      return res.sendError(404, 'Card not found');
    }
    const paymentIntent = await StripeService.createOffSessionPaymentIntent(
      customer.id,
      cards.data[0].id,
      calculateOrderAmount(items),
      'usd',
    );

    res.sendSuccess({
      client_secret: paymentIntent.client_secret,
    });

  };

  createOnSessionPaymentIntent = async (req: Request, res: AppResponse, _next: NextFunction): Promise<void> => {

    const { items } = req.body;

    const paymentIntent = await StripeService.createOnSessionPaymentIntent(calculateOrderAmount(items), 'usd');

    res.sendSuccess({
      client_secret: paymentIntent.client_secret,
    });

  };

  createSetupIntent = async (req: AppRequest, res: AppResponse, _next: NextFunction): Promise<void> => {

    const email = req.user.email;
    let customer = await StripeService.findCustomerByEmail(email);
    if (customer === null) {
      customer = await StripeService.createCustomer(email);
    }
    const intent = await StripeService.createSetupIntent(customer.id);
    res.sendSuccess({
      client_secret: intent.client_secret,
    });

  };

  getCards = async (req: AppRequest, res: AppResponse, _next: NextFunction): Promise<void> => {

    const email = req.user.email;
    let customer = await StripeService.findCustomerByEmail(email);
    if (customer === null) {
      customer = await StripeService.createCustomer(email);
    }

    const cards = await StripeService.listCards(customer.id);
    res.sendSuccess(cards);

  };

  chargeEventBill = async (req: AppRequest, res: AppResponse, _next: NextFunction): Promise<void> => {
    const { event_id, payment_method_id } = req.parseBody(chargeEventBillSchema);
    const event = await EventBookingRepository.getEvent(event_id);
    const price = calculateEventPrice(event);

    const customer = await StripeService.findCustomerByEmail(req.user.email);

    const paymentIntent = await StripeService.createOffSessionPaymentIntent(
      customer.id,
      payment_method_id,
      price.price,
      'usd',
      {
        event_id,
      }
    );

    res.sendSuccess({
      client_secret: paymentIntent.client_secret,
    });
  }

  tipChef = async (req: AppRequest, res: AppResponse, _next: NextFunction): Promise<void> => {
    const { event_id, payment_method_id, tipping_percent } = req.body;
    const event = await EventBookingRepository.getEvent(event_id);
    const price = calculateEventPrice(event);
    const amount = price.price * tipping_percent;

    const customer = await StripeService.findCustomerByEmail(req.user.email);

    const paymentIntent = await StripeService.createOffSessionPaymentIntent(
      customer.id,
      payment_method_id,
      amount,
      'usd',
      {
        event_id,
      }
    );

    res.sendSuccess({
      client_secret: paymentIntent.client_secret,
    });
  }
}
const calculateOrderAmount = (_items: any) => {
  // Replace this constant with a calculation of the order's amount
  // Calculate the order total on the server to prevent
  // people from directly manipulating the amount on the client
  return 1400;
};

export default () => {
  const controller = new PaymentController();
  const router = new AppRouter();
  router.post('/webhook', express.raw({ type: 'application/json' }), controller.webhookPayment);

  router.router.use(passport.authenticate('jwt', { session: false }));


  router.post('/create-off-session-payment-intent', controller.createOffSessionPaymentIntent);

  router.post('/create-on-session-payment-intent', controller.createOnSessionPaymentIntent);

  router.post('/charge-event-bill', controller.chargeEventBill);

  router.post('/create-setup-intent', controller.createSetupIntent);

  router.post('/tip-chef', controller.tipChef)

  router.get('/get-cards', controller.getCards);

  return router.router;
};
