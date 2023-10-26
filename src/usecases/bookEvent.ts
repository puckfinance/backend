import { Prisma } from "@prisma/client";
import { EventDetailOutput, EventDetailPricingOutput, IPricedEntity, EventDetailPricingWithTransactionOutput, EventWithNavigation, EventViewModel } from "../domain/outputs/eventDetailOutput";
import { BookEventSchema } from "../domain/inputs/bookEventSchema";


const sumPrices = (entities: IPricedEntity[]) => entities.reduce((acc, entity) => acc + entity.price, 0);

export const addTransactionFieldsToEvent = (event: EventDetailPricingOutput): EventDetailPricingWithTransactionOutput => {
    if (!event.transactions || event.transactions.length === 0) return {
        ...event,
        transaction_status: 'pending',
        paid: false
    }
    return {
        ...event,
        transaction_status: event.transactions[event.transactions.length - 1].status,
        paid: event.transactions.some(transaction => transaction.status === 'succeeded')
    }
}

export const eventToBookEventSchema = (event: EventWithNavigation): EventViewModel => {
    const { serving_styles, sitting_styles, chef_types, occasions, cuisines, add_ons, ingredients, address, start_date, party_size } = event;
    return {
        ...event,
        serving_style: serving_styles[0],
        sitting_style: sitting_styles[0],
        chef_type: chef_types[0],
        occasions: occasions,
        cuisines: cuisines,
        add_ons: add_ons,
        ingredient: ingredients[0],
        guest_count: party_size,
        address: address?.address,
        zip_code: address?.zip_code,
        date: start_date.toISOString(),
        paid: event.transactions.some(transaction => transaction.status === 'succeeded'),
        price: sumPrices(serving_styles) + sumPrices(sitting_styles) + sumPrices(chef_types) + sumPrices(occasions) + sumPrices(cuisines) + sumPrices(add_ons) + sumPrices(ingredients)
    };
}

export const calculateEventPrice = (event: EventDetailOutput): EventDetailPricingOutput => {
    const { serving_styles, sitting_styles, chef_types, occasions, cuisines, add_ons, ingredients } = event;
    const price = sumPrices(serving_styles) + sumPrices(sitting_styles) + sumPrices(chef_types) + sumPrices(occasions) + sumPrices(cuisines) + sumPrices(add_ons) + sumPrices(ingredients);
    return {
        ...event,
        price
    };
}


const extractBaseMutationFieldsFromBookEventSchema = (bookEventSchema: BookEventSchema) => {
    const { serving_style, sitting_style, chef_type, occasions, cuisines, add_ons, ingredient, guest_count, address, zip_code, date, time } = bookEventSchema;
    return {
        serving_styles: {
            connect: {
                id: serving_style,
            },
        },
        sitting_styles: {
            connect: {
                id: sitting_style,
            },
        },
        chef_types: {
            connect: {
                id: chef_type,
            },
        },
        occasions: {
            connect: occasions.map((occasion: string) => ({ id: occasion })),
        },
        cuisines: {
            connect: cuisines.map((cuisine: string) => ({ id: cuisine })),
        },
        add_ons: {
            connect: add_ons.map((addOn: string) => ({ id: addOn })),
        },
        ingredients: {
            connect: {
                id: ingredient,
            },
        },
        party_size: guest_count,
        address: {
            create: {
                address,
                zip_code,
            },
        },
        start_date: date,
        time,
        end_date: date,
        title: '',
    };
}

export const convertBookEventSchemaToCreateEventInput = (bookEventSchema: BookEventSchema) => (creatorId: string): Prisma.EventCreateInput => {
    return {
        ...extractBaseMutationFieldsFromBookEventSchema(bookEventSchema),
        creator: {
            connect: {
                id: creatorId,
            },
        },

    };
}

export const convertBookEventSchemaToUpdateEventInput = (bookEventSchema: BookEventSchema): Prisma.EventUpdateInput => {
    return {
        ...extractBaseMutationFieldsFromBookEventSchema(bookEventSchema),
    };
}
