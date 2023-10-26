import { User, Address, Event, Transaction, AddOn, ChefType, Cuisine, Ingredient, Occasion, ServingStyle, SittingStyle, EventStatus } from "@prisma/client";

export interface IPricedEntity {
    price: number;
}

export type EventWithNavigation = Event & {
    creator: User;
    chef: User;
    cuisines: Cuisine[];
    ingredients: Ingredient[];
    occasions: Occasion[];
    add_ons: AddOn[];
    serving_styles: ServingStyle[];
    chef_types: ChefType[];
    sitting_styles: SittingStyle[];
    address: Address;
    transactions: Transaction[];
}

export type EventViewModel = {
    serving_style: ServingStyle;
    sitting_style: SittingStyle;
    chef_type: ChefType;
    chef_id: string;
    occasions: Occasion[];
    cuisines: Cuisine[];
    add_ons: AddOn[];
    id: string
    title: string
    start_date: Date
    end_date: Date
    created_at: Date
    updated_at: Date
    creator_id: string
    address_id: string | null
    party_size: number | null
    status: EventStatus
    ingredient: Ingredient;
    guest_count: number;
    address: string;
    zip_code: string;
    date: string;
    time: string;
    paid: boolean;
    price: number;
    chef: User;
}

export type EventDetailOutput = Event & {
    creator: User;
    cuisines: IPricedEntity[];
    ingredients: IPricedEntity[];
    occasions: IPricedEntity[];
    add_ons: IPricedEntity[];
    serving_styles: IPricedEntity[];
    chef_types: IPricedEntity[];
    chef: User;
    sitting_styles: IPricedEntity[];
    transactions: Transaction[];
    address: Address;
}

export type EventDetailPricingOutput = EventDetailOutput & {
    price: number;
}

export type EventDetailPricingWithTransactionOutput = EventDetailPricingOutput & {
    transaction_status: string;
    paid: boolean;
}
