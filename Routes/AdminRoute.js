import express from "express";
import con from "../utils/db.js";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";

const router = express.Router();

router.post("/admin_login", (req, res) => {
  const sql = "SELECT * from admin Where username = ? and password = ?";
  con.query(sql, [req.body.username, req.body.password], (err, result) => {
    if (err) return res.json({ loginStatus: false, Error: "Query error" });
    if (result.length > 0) {
      const username = result[0].username;
      const token = jwt.sign(
        { role: "admin", username: username, adminID: result[0].adminID },
        "jwt_secret_key",
        { expiresIn: "1d" }
      );
      res.cookie("token", token);
      return res.json({ loginStatus: true });
    } else {
      return res.json({
        loginStatus: false,
        Error: "wrong username or password",
      });
    }
  });
});

router.get("/voice", (req, res) => {
  const sql = "SELECT * FROM voice";
  con.query(sql, (err, result) => {
    if (err) return res.json({ Status: false, Error: "Query Error" });
    return res.json({ Status: true, Result: result });
  });
});

router.post("/add_voice", (req, res) => {
  const sql = "INSERT INTO voice (`name`) VALUES (?)";
  con.query(sql, [req.body.voice], (err, result) => {
    if (err) return res.json({ Status: false, Error: "Query Error" });
    return res.json({ Status: true });
  });
});

// image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "Public/Images");
  },
  filename: (req, file, cb) => {
    cb(
      null,
      file.fieldname + "_" + Date.now() + path.extname(file.originalname)
    );
  },
});
const upload = multer({
  storage: storage,
});
// end imag eupload

router.post("/add_nb", upload.single("image"), (req, res) => {
  const sql = `INSERT INTO notablebatangaueños 
    (name, information, voiceID, image) 
    VALUES (?)`;
  const values = [
    req.body.name,
    req.body.information,
    req.body.voiceID,
    req.file.filename,
  ];
  con.query(sql, [values], (err, result) => {
    if (err) return res.json({ Status: false, Error: err });
    return res.json({ Status: true });
  });
});

router.put("/edit_nb/:nbID", (req, res) => {
  const nbID = req.params.nbID;
  const sql = `UPDATE notablebatangaueños set name = ?, information = ?, voiceID = ? Where nbID = ?`;
  const values = [req.body.name, req.body.information, req.body.voiceID];
  con.query(sql, [...values, nbID], (err, result) => {
    if (err) return res.json({ Status: false, Error: "Query Error" + err });
    return res.json({ Status: true, Result: result });
  });
});

router.get("/nb", (req, res) => {
  const sql = "SELECT * FROM notablebatangaueños";
  con.query(sql, (err, result) => {
    if (err) return res.json({ Status: false, Error: "Query Error" });
    return res.json({ Status: true, Result: result });
  });
});

router.get("/nb/:nbID", (req, res) => {
  const nbID = req.params.nbID;
  const sql = "SELECT * FROM notablebatangaueños WHERE nbID = ?";
  con.query(sql, [nbID], (err, result) => {
    if (err) return res.json({ Status: false, Error: "Query Error" });
    return res.json({ Status: true, Result: result });
  });
});

router.delete("/delete_nb/:nbID", (req, res) => {
  const nbID = req.params.nbID;
  const sql = "delete from notablebatangaueños where nbID = ?";
  con.query(sql, [nbID], (err, result) => {
    if (err) return res.json({ Status: false, Error: "Query Error" + err });
    return res.json({ Status: true, Result: result });
  });
});

router.get("/logout", (req, res) => {
  res.clearCookie("token");
  return res.json({ Status: true });
});

export { router as adminRouter };
