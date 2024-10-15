import express from "express";
import con from "../utils/db.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { exec } from "child_process";
import { promises as fs } from "fs";
import bcrypt from "bcrypt";

const router = express.Router();
dotenv.config();

// Import bcrypt for password hashing
 // Import bcrypt

 router.post("/tokenlogin", (req, res) => {
  const token = req.body.token;
  console.log(token);

  if (!token) {
    return res.status(401).json({ loginStatus: false, Error: "No token provided" });
  }

  jwt.verify(token, "superSecretKey", (err, decoded) => {
    if (err) {
      return res.status(401).json({ loginStatus: false, Error: "Invalid token" });
    }

    const visitorID = decoded.visitorID; // Extract visitorID from the token
    const username = decoded.username; // Assuming username is in the token
    const password = decoded.password; // Assuming password is in the token

    // Check if the visitor already exists
    const sql = "SELECT * FROM visitor WHERE username = ?";
    con.query(sql, [username], (err, result) => {
      if (err) return res.json({ loginStatus: false, Error: "Query error" });

      if (result.length > 0) {
        // Visitor exists, log them in
        const query = "INSERT INTO visitor_logins (visitorID) VALUES (?)";
        con.query(query, [visitorID], (err, results) => {
          if (err) return res.json({ loginStatus: false, Error: "Query error" });

          res.cookie("token", token); // Set token in cookie if needed
          return res.json({ loginStatus: true, visitorID });
        });
      } else {
        // Visitor does not exist, create a new record
        // Use the hashed password from the token directly
        const insertSql = "INSERT INTO visitor (username, `password`) VALUES (?, ?)";
        con.query(insertSql, [username, password], (err, insertResult) => { // Use `password` directly
          if (err) return res.json({ loginStatus: false, Error: "Query error" });

          // Now log in the newly created visitor
          const query = "INSERT INTO visitor_logins (visitorID) VALUES (?)";
          const newVisitorID = insertResult.insertId; // Get the ID of the newly inserted visitor

          con.query(query, [newVisitorID], (err, results) => {
            if (err) return res.json({ loginStatus: false, Error: "Query error" });

            res.cookie("token", token); // Set token in cookie if needed
            return res.json({ loginStatus: true, visitorID: newVisitorID });
          });
        });
      }
    });
  });
});


router.post("/visitor_login", (req, res) => {
  const sql = "SELECT * from visitor Where username = ? and password = ?";
  con.query(sql, [req.body.username, req.body.password], (err, result) => {
    if (err) return res.json({ loginStatus: false, Error: "Query error" });
    if (result.length > 0) {
      const query = "INSERT INTO visitor_logins (visitorID) VALUES (?)";
      con.query(query, [result[0].visitorID], (err, results) => {
        if (err) return res.json({ loginStatus: false, Error: "Query error" });
        const username = result[0].username;
        const token = jwt.sign(
          {
            role: "visitor",
            username: username,
            visitorID: result[0].visitorID,
          },
          "jwt_secret_key",
          { expiresIn: "1d" }
        );
        res.cookie("token", token);
        return res.json({ loginStatus: true, visitorID: result[0].visitorID });
      });
    } else {
      return res.json({
        loginStatus: false,
        Error: "Wrong username or password",
      });
    }
  });
});

router.post("/set_instructed/", (req, res) => {
  const { visitorID } = req.body;
  const query = "INSERT INTO visitor_instructed (visitorID) VALUES (?)";
  con.query(query, [visitorID], (err, results) => {
    if (err) return res.json({ Status: false, Error: "Query error" });
    return res.json({ Status: true, Result: results });
  });
});

router.get("/get_instructed", (req, res) => {
  const sql = "SELECT * FROM visitor_instructed";
  con.query(sql, (err, result) => {
    if (err) return res.json({ Status: false, Error: "Query Error" });
    return res.json({ Status: true, Result: result });
  });
});

router.get("/detail/:visitorID", (req, res) => {
  const visitorID = req.params.visitorID;
  const sql = "SELECT * FROM visitor WHERE visitorID = ?";
  con.query(sql, [visitorID], (err, result) => {
    if (err) return res.json({ Status: false });
    // Get rewardpoints
    const sqlRewardPoint = "SELECT * FROM reward_points WHERE visitorID = ?";
    con.query(sqlRewardPoint, [visitorID], (err, rewardPoint) => {
      if (err) throw err;
      result[0].rewardPoints = rewardPoint[0].totalPoints;
      return res.json({ Status: true, Result: result });
    });
  });
});

// Edit rewardpoints
router.put("/edit_visitor/:visitorID", (req, res) => {
  const visitorID = req.params.visitorID;
  const sql = `UPDATE reward_points set totalPoints = ? Where visitorID = ?`;
  const totalPoints = req.body.rewardPoints;
  const values = [totalPoints];
  con.query(sql, [...values, visitorID], (err, result) => {
    if (err) return res.json({ Status: false, Error: "Query Error" + err });
    return res.json({ Status: true, Result: result });
  });
});

// Get rewardpoints
router.get("/rewardPoints", (req, res) => {
  const sql = "SELECT * FROM reward_points ORDER BY totalPoints DESC";
  con.query(sql, (err, rewardPoints) => {
    if (err) return res.json({ Status: false, Error: "Query Error" });
    const results = [];

    // Get username
    rewardPoints.forEach((rewardPoint) => {
      const visitorID = rewardPoint.visitorID;
      const sqlUsername = "SELECT * FROM visitor WHERE visitorID = ?";
      con.query(sqlUsername, [visitorID], (err, visitor) => {
        if (err) return res.json({ Status: false, Error: "Query Error" });
        rewardPoint.username = visitor[0].username;
        results.push(rewardPoint);

        if (results.length === rewardPoints.length) {
          return res.json({ Status: true, Result: results });
        }
      });
    });
  });
});

router.get("/nb", (req, res) => {
  const sql = "SELECT * FROM notablebatangueños";
  con.query(sql, (err, result) => {
    if (err) return res.json({ Status: false, Error: "Query Error" });
    return res.json({ Status: true, Result: result });
  });
});

router.get("/nb/:nbID", (req, res) => {
  const nbID = req.params.nbID;
  const sql = "SELECT * FROM notablebatangueños WHERE nbID = ?";
  con.query(sql, [nbID], (err, result) => {
    if (err) return res.json({ Status: false, Error: "Query Error" });
    return res.json({ Status: true, Result: result });
  });
});

router.get("/logout", (req, res) => {
  res.clearCookie("token");
  return res.json({ Status: true });
});

// To get the question with choices
router.get("/questions", (req, res) => {
  //Get question
  const sqlAssessment = "SELECT * FROM assessment";
  con.query(sqlAssessment, (err, questions) => {
    if (err) throw err;

    const results = [];
    // Get choices
    questions.forEach((question) => {
      const sqlChoices =
        "SELECT * FROM question_choices WHERE assessmentID = ?";
      con.query(sqlChoices, [question.assessmentID], (err, choices) => {
        if (err) throw err;
        question.choices = choices;
        results.push(question);
        if (results.length === questions.length) {
          res.json(results);
        }
      });
    });
  });
});

// Add a feedback
router.post("/feedback", (req, res) => {
  const { visitorID, feedback } = req.body;

  con.query(
    "INSERT INTO feedback (visitorID, feedback) VALUES (?, ?)",
    [visitorID, feedback],
    (err, result) => {
      if (err) return res.json({ Status: false, Error: "Query Error" + err });
      return res.json({ Status: true, Result: result });
    }
  );
});

export { router as visitorRouter };
