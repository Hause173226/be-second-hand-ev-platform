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

export const getEkycConfig = () => {
  const baseUrl = process.env.FPT_EKYC_BASE_URL || "";
  const apiKey = process.env.FPT_EKYC_API_KEY || "";

  return {
    baseUrl,
    apiKey,
  };
};
