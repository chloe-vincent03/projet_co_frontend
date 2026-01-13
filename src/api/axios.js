import axios from "axios";

const api = axios.create({
  baseURL: "https://vs2g6quq7gt.preview.hosting-ik.com",
  withCredentials: true,
});

export default api;
