import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import type { Env } from '../../config/env.js';
import { Session, SessionSchema } from './schemas/session.schema.js';
import { User, UserSchema } from './schemas/user.schema.js';
import { SessionsService } from './sessions.service.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Session.name, schema: SessionSchema },
    ]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
        signOptions: { algorithm: 'HS256', issuer: 'ubook' },
        verifyOptions: { algorithms: ['HS256'], issuer: 'ubook' },
      }),
    }),
  ],
  providers: [UsersService, SessionsService],
  exports: [UsersService, SessionsService, JwtModule],
})
export class IdentityModule {}
