import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2022-11-15',
});
class StripeService {
  findCustomerByEmail = async (email: string): Promise<Stripe.Customer | null> => {
    const customers = await stripe.customers.list({ email });
    if (customers.data.length > 0) {
      return customers.data[0];
    }
    return null;
  };

  createCustomer = async (email: string): Promise<Stripe.Customer> => {
    const customer = await stripe.customers.create({ email });
    return customer;
  };

  listCards = async (customerId: string): Promise<Stripe.ApiList<Stripe.PaymentMethod>> => {
    const cards = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });
    return cards;
  };

  createSetupIntent = async (customerId: string): Promise<Stripe.Response<Stripe.SetupIntent>> => {
    const intent = await stripe.setupIntents.create({
      customer: customerId,
    });
    return intent;
  };

  createOnSessionPaymentIntent = async (amount: number, currency: string) => {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return paymentIntent;
  };

  createOffSessionPaymentIntent = async (
    customerId: string,
    paymentMethodId: string,
    amount: number,
    currency: string,
    metadata?: {
      [x: string]: string;
    }
  ): Promise<Stripe.Response<Stripe.PaymentIntent>> => {
    try {
      const intent = await stripe.paymentIntents.create({
        amount,
        currency,
        customer: customerId,
        payment_method: paymentMethodId,
        metadata,
        off_session: true,
        confirm: true,
      });
      return intent;
    } catch (err) {
      // Error code will be authentication_required if authentication is needed
      console.log('Error code is: ', err.code);
      const paymentIntentRetrieved = await stripe.paymentIntents.retrieve(err.raw.payment_intent.id);
      console.log('PI retrieved: ', paymentIntentRetrieved.id);
      if (err.code == 'authentication_required') {
        // Pass the failed PaymentIntent to your client from your server
        stripe.paymentIntents
          .confirm(paymentIntentRetrieved.client_secret, {
            payment_method: paymentIntentRetrieved.last_payment_error.payment_method.id,
          })
          .then(function (result) {
            if (result.status !== 'succeeded') {
              // Show error to your customer
              console.log('Error: ', result.status, result.statement_descriptor_suffix);
            } else {
              if (result.status === 'succeeded') {
                // The payment is complete!
                console.log('Payment is complete!');
              }
            }
          });
      }

      return paymentIntentRetrieved;
    }
  };

  confirmCardPayment = async (
    paymentIntentId: string,
    paymentMethodId: string,
  ): Promise<Stripe.Response<Stripe.PaymentIntent>> => {
    const intent = await stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethodId,
    });
    return intent;
  };

  constructEvent = (body: any, sig: string, endpointSecret: string) => {
    return stripe.webhooks.constructEvent(body, sig, endpointSecret);
  }
}

export default new StripeService();
