export type JwtAccessPayload = {
  sub: string;
  email?: string | null;
  typ: 'access';
};

export type JwtRefreshPayload = {
  sub: string;
  jti: string;
  typ: 'refresh';
};
