import { UsernamePasswordInput } from "src/resolvers/UsernamePasswordInput";

export const validateEmail = (email: string): boolean =>
  /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(
    email
  );
export const containsSpecialChars = (str: string): boolean => {
  const specialChars = /[`!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/;
  return specialChars.test(str);
};
export const validateRegister = (options: UsernamePasswordInput) => {
  if (!validateEmail(options.email)) {
    return [
      {
        field: "email",
        message: "The email you provided is invalid",
      },
    ];
  }
  if (containsSpecialChars(options.username)) {
    return [
      {
        field: "username",
        message: "Username cannot contain special characters",
      },
    ];
  }
  if (options.username.length <= 2) {
    return [
      {
        field: "username",
        message: "Username must contain at least 3 characters",
      },
    ];
  }
  if (options.password.length <= 6) {
    return [
      {
        field: "password",
        message: "Password must contain at least 6 characters",
      },
    ];
  }
  return null;
};
