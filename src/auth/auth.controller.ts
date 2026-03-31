import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Role, User } from '@prisma/client';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { AllowedRoles, AuthUser, Public } from './decorators';
import { ChangePasswordDto, LoginUserDto } from './dto';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  getMe(@AuthUser() user: User) {
    return this.authService.getMyUserData(user);
  }

  @Post('login')
  @Public()
  @ApiConsumes('application/x-www-form-urlencoded')
  async loginWeb(
    @Body()
    body: LoginUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user } = await this.authService.login(body);

    const token = await this.authService.signToken(user);

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'none',
      secure: true,
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24 hours expiration time
    });
  }

  // @Post('token')
  // async retoken(@AuthUser() user: User) {
  //   const token = await this.authService.signToken(user);
  //   return { user, token };
  // }

  @Post('logout')
  async logout(
    @Res({ passthrough: true }) res: Response,
    @AuthUser() user: User,
  ) {
    res.clearCookie('token', {
      httpOnly: true,
      sameSite: 'none',
      secure: true,
    });

    return {
      message: `User ${user.username} with the id ${user.id} logged out successfully`,
    };
  }

  @Post('change-password')
  async changePassword(
    @AuthUser() user: User,
    @Body() body: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user, body);
  }

  @Post('forgot-password')
  @Public()
  async forgotPassword(@Body() body: { username: string }) {
    return this.authService.forgotPassword(body.username);
  }

  @Delete(':id')
  @AllowedRoles(Role.ADMIN)
  async deleteUser(@Param('id') id: number) {
    await this.authService.deleteUser(id);
  }
}
