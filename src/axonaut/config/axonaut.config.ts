import { Injectable } from '@nestjs/common';

@Injectable()
export class AxonautConfig {
  public apiKey: string = process.env.AXONAUT_API_KEY;
  public baseUrl: string = process.env.AXONAUT_BASE_URL;
}
