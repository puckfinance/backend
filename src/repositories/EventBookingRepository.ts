import { Event, EventStatus, User, Prisma } from '@prisma/client'
import prisma from '../infrastructure/prisma';
import { EventWithNavigation } from '../domain/outputs/eventDetailOutput';


export namespace EventBookingRepository {
    const defaultIncludes = {
        chef_types: true,
        cuisines: true,
        add_ons: true,
        address: true,
        chef: true,
        ingredients: true,
        occasions: true,
        sitting_styles: true,
        serving_styles: true,
        creator: true,
        transactions: true
    }

    export const createEvent = async (event: Prisma.EventCreateInput): Promise<Event> => {
        const booking = await prisma.event.create({
            data: {
                ...event, chef: {
                    connect: {
                        //TODO: This is hardcoded for now, but should be dynamic
                        id: "01cab4f5-672f-4486-94fe-847066f109b0"
                    }
                }
            },
        });
        return booking;
    }
    export const getEvents = async (user: User): Promise<EventWithNavigation[]> => {
        const events = await prisma.event.findMany({
            where: {
                creator_id: user.id,
                transactions: {
                    some: {
                        status: 'succeeded'
                    }
                }
            },
            include: defaultIncludes,
        });
        return events;
    }

    export const getEvent = async (id: string): Promise<EventWithNavigation | null> => {
        const event = await prisma.event.findFirst({
            where: {
                id,
                // transactions: {
                //     some: {
                //         status: 'succeeded'
                //     }
                // }
            },
            include: defaultIncludes,
        });
        return event;
    }

    export const getUserActiveEvent = async (user_id: string) => {
        const event = await prisma.event.findFirst({
            where: {
                creator_id: user_id,
                status: {
                    in: [
                        EventStatus.REQUEST_SENT,
                    ]
                },
                transactions: {
                    some: {
                        status: 'succeeded'
                    }
                }
            },
            include: defaultIncludes,
        });
        return event;
    }

    export const getMatchingChefs = async (id: string): Promise<User[]> => {
        const event = await prisma.event.findUnique({
            where: {
                id,
            },
            include: defaultIncludes,
        });
        const chefs = await prisma.user.findMany({
            where: {
                chef_type_id: event.chef_types[0].id,
            },
        });
        return chefs;
    }

    export const updateEvent = async (id: string, event: Prisma.EventUpdateInput): Promise<Event> => {
        const e = await prisma.event.update({
            where: {
                id,
            },
            data: event,
        });
        return e;
    }

    export const deleteEvent = async (id: string): Promise<Event> => {
        const event = await prisma.event.delete({
            where: {
                id,
            },
        });
        return event;
    }

    export const updateChef = async (id: string, chef_id: string): Promise<Event> => {
        const e = await prisma.event.update({
            where: {
                id,
            },
            data: {
                chef_id,
                status: EventStatus.CHEF_ACCEPTED
            },
        });
        return e;
    }



}