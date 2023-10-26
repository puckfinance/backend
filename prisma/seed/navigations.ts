import { Prisma } from '@prisma/client'

export const chefTypes: Prisma.ChefTypeCreateInput[] = [
  {
    id: '01cab4f5-672f-4486-94fe-847066f109a0',
    name: 'Michelin',
    icon: 'glass',
    price: 1000,
  },
  {
    id: '01cab4f5-672f-4486-94fe-847066f109a1',
    name: 'Standard',
    icon: 'music',
    price: 100,
  },
  {
    id: '01cab4f5-672f-4486-94fe-847066f109a2',
    icon: 'heart',
    name: 'Basic',
    price: 50,
  }
];

export const commentTags = [
  {
    name: 'Food was amazing',
  },
  {
    name: 'Chef was amazing',
  },
  {
    name: 'Chef was late',
  },
  {
    name: 'Chef was rude',
  },
  {
    name: 'Chef was unprofessional',
  },
  {
    name: 'Chef was unprepared',
  },
]

export const cuisines: Prisma.CuisineCreateInput[] = [
  {
    id: '01cab4f5-672f-4486-94fe-847066f109a1',
    name: 'African',
    price: 100,
  },
  //add 8 more with country name
  {
    id: '01cab4f5-672f-4486-94fe-847066f109a2',
    name: 'American',
    price: 100,
  },
  {
    id: '01cab4f5-672f-4486-94fe-847066f109a3',
    name: 'British',
    price: 100,
  },
  {
    id: '01cab4f5-672f-4486-94fe-847066f109a4',
    name: 'Caribbean',
    price: 100,
  },
  {
    id: '01cab4f5-672f-4486-94fe-847066f109a5',
    name: 'Chinese',
    price: 100,
  },
  {
    id: '01cab4f5-672f-4486-94fe-847066f109a6',
    name: 'Eastern European',
    price: 100,
  },
  {
    id: '01cab4f5-672f-4486-94fe-847066f109a7',
    name: 'French',
    price: 100,
  },
  {
    id: '01cab4f5-672f-4486-94fe-847066f109a8',
    name: 'Indian',
    price: 100,
  },
  {
    id: '01cab4f5-672f-4486-94fe-847066f109a9',
    name: 'Italian',
    price: 100,
  },
  {
    id: '01cab4f5-672f-4486-94fe-847066f109a10',
    name: 'Japanese',
    price: 100,
  },
  {
    id: '01cab4f5-672f-4486-94fe-847066f109a11',
    name: 'Korean',
    price: 100,
  },
  {
    id: '01cab4f5-672f-4486-94fe-847066f109a12',
    name: 'Mediterranean',
    price: 100,
  }
];
export const addOns: Prisma.AddOnCreateInput[] = [{
  id: '01cab4f5-672f-4486-94fe-847066f109a2',
  name: 'Rentals',
  icon: 'cog',
  price: 200,
},
{
  id: '01cab4f5-672f-4486-94fe-847066f109a3',
  name: 'Decor',
  icon: 'signal',
  price: 200,
},
{
  id: '01cab4f5-672f-4486-94fe-847066f109a4',
  icon: 'inbox',
  name: 'Dishwashing',
  price: 200,
},

];
export const ingredients: Prisma.IngredientCreateInput[] = [
  {
    id: '01cab4f5-672f-4486-94fe-847066f109a3',
    name: 'Normal ingredient',
    icon: 'copy',
    price: 300,
  },
  {
    id: '01cab4f5-672f-4486-94fe-847066f109a4',
    name: 'Special ingredient',
    icon: "flask",
    price: 300,
  },

];
export const occasions: Prisma.OccasionCreateInput[] = [
  {
    id: '01cab4f5-672f-4486-94fe-847066f109a1',
    name: 'Regular meal',
    price: 400,
  },
  {
    id: '01cab4f5-672f-4486-94fe-847066f109a2',
    name: 'Holiday',
    price: 400,
  },
  //add 4 more 
  {
    id: '01cab4f5-672f-4486-94fe-847066f109a3',
    name: 'Birthday',
    price: 400,
  },
  {
    id: '01cab4f5-672f-4486-94fe-847066f109a4',
    name: 'Anniversary',
    price: 400,
  },
  {
    id: '01cab4f5-672f-4486-94fe-847066f109a5',
    name: 'Retirement',
    price: 400,
  },
  {
    id: '01cab4f5-672f-4486-94fe-847066f109a6',
    name: 'Wedding',
    price: 400,
  },
  {
    id: '01cab4f5-672f-4486-94fe-847066f109a7',
    name: 'Baby shower',
    price: 400,
  },
  {
    id: '01cab4f5-672f-4486-94fe-847066f109a8',
    name: 'Graduation',
    price: 400,
  },
];

export const servingStyles: Prisma.ServingStyleCreateInput[] = [
  {
    id: '01cab4f5-672f-4486-94fe-847066f109a1',
    name: 'Buffet',
    price: 600,
    icon: 'beer'
  },
  {
    id: '01cab4f5-672f-4486-94fe-847066f109a2',
    name: 'Family style',
    price: 600,
    icon: 'github-alt'
  },
  {
    id: '01cab4f5-672f-4486-94fe-847066f109a3',
    name: 'Plated',
    price: 600,
    icon: 'frown-o'

  },
  {
    id: '01cab4f5-672f-4486-94fe-847066f109a4',
    name: 'Coursed out',
    price: 600,
    icon: 'circle'
  },

];
export const sittingStyles: Prisma.SittingStyleCreateInput[] = [{
  id: '01cab4f5-672f-4486-94fe-847066f109a5',
  name: 'Side by side',
  price: 500,
  icon: 'dollar'
},
{
  id: '01cab4f5-672f-4486-94fe-847066f109a6',
  name: 'Face to face',
  price: 500,
  icon: 'moon-o'
},
{
  id: '01cab4f5-672f-4486-94fe-847066f109a1',
  name: 'Mobile',
  price: 500,
  icon: 'sun-o'
},
];
