export interface IAddress {
  _id?: string;
  fullAddress: string;
  ward: string;
  district: string;
  city: string;
  province: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
