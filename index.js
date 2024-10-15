import express from "express";
import cors from "cors";
import { adminRouter } from "./Routes/AdminRoute.js";
import { visitorRouter } from "./Routes/VisitorRoute.js";
import Jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";


const app = express();


app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000", "http://localhost:8080"], 
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());
app.use("/admin", adminRouter);
app.use("/visitor", visitorRouter);
app.use(express.static("Public"));

const getUser = (req, res, next) => {
  const token = req.cookies.token;
  if (token) {
    Jwt.verify(token, "jwt_secret_key", (err, decoded) => {
      if (err) return res.json({ Status: false, Error: "Wrong Token" });
      if (decoded.role == "admin") {
        req.id = decoded.adminID;
      } else {
        req.id = decoded.visitorID;
      }
      req.role = decoded.role;
      next();
    });
  } else {
    return res.json({ Status: false, Error: "Not autheticated" });
  }
};
app.get("/getUser", getUser, (req, res) => {
  return res.json({ Status: true, role: req.role, id: req.id });
});

dotenv.config();

const port = process.env.port || 3000;

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
