import jwt from 'jsonwebtoken';

const { sign } = jwt;

export const generateAccessToken = (user) => {
  return sign(
    {
      userId: user.id,
      role: user.role,
      subCityId: user.subCityId,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
};

export const generateRefreshToken = (user) => {
  return sign({ userId: user.id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  });
};
