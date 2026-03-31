export type GetSignedURLParams = {
  operation: 'getObject' | 'putObject';
  Key?: string;
  isPublic?: boolean;
  Expires?: number;
};
