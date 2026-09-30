export interface Address {
  id: string;
  title: string;
  recipientName: string;
  recipientPhone: string;
  province: string;
  city: string;
  addressLine: string;
  postalCode: string;
  latitude: number | null;
  longitude: number | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}
