export interface IMembershipPackage {
  name: string;
  slug: string;
  description: string;
  price: number;
  duration: number;
  features: {
    maxListings: number;
    prioritySupport: boolean;
    featuredListing: boolean;
    autoRenew: boolean;
    badge: string;
  };
  isActive: boolean;
  isPermanent: boolean;
  displayOrder: number;
  createdAt?: Date;
  updatedAt?: Date;
}
