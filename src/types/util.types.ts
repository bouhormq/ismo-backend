export type KeyValueObject<KeyType extends PropertyKey = PropertyKey> = Record<
  KeyType,
  unknown
>;

export type DeepPartial<T> = T extends KeyValueObject
  ? {
      [K in keyof T]?: DeepPartial<T[K]>;
    }
  : T extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T | undefined;

export type DateInput = Date | string | number;

export interface TJSON {
  [Key: string]: string | number | Date | boolean | string[] | TJSON | TJSON[];
}

export type PaginationOptions = {
  offset: string;
  limit: string;
};
