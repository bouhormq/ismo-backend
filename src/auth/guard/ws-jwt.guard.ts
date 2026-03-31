import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly db: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const client = context.switchToWs().getClient();
    const header: string = client.handshake.headers['authorization'];
    const authToken = header.split(' ').pop();
    const payload = this.jwtService.verify(authToken, {
      secret: process.env.JWT_SECRET,
    });
    const user = await this.db.user.findUnique({
      where: {
        id: payload.sub,
      },
    });
    return Boolean(user);
  }
}
