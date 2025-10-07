export const getAppConfig = () => {
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    return {
      frontendUrl: "https://sdn-fe.vercel.app",
      backendUrl: "https://bebusticketsalessystem-1.onrender.com",
    };
  } else {
    return {
      frontendUrl: "http://localhost:5173",
      backendUrl: "http://localhost:8081",
    };
  }
};
