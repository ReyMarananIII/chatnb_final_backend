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
        Error: "Wrong username or password",
      });
    }
  });
});

// image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "Public/Uploaded");
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

router.post("/add_nb", upload.any(), (req, res) => {
  const sql = `INSERT INTO notablebatangueños 
    (name, information, voiceID, image, model, bgImage, reference) 
    VALUES (?)`;
  const values = [
    req.body.name,
    req.body.information,
    req.body.voiceID,
    req.files[0].filename, // Image
    req.files[1].filename, // Model
    req.files[2].filename, // Bg Image
    req.body.reference,
  ];
  con.query(sql, [values], (err, result) => {
    if (err) return res.json({ Status: false, Error: err });
    return res.json({ Status: true });
  });
});

router.put("/edit_nb/:nbID", upload.any(), (req, res) => {
  const nbID = req.params.nbID;
  const sql = `UPDATE notablebatangueños set name = ?, information = ?, voiceID = ?, image = ?, model = ?, bgImage = ?, reference = ? Where nbID = ?`;

  // To get the image file inside all the uploaded files
  const getImage = (files) => {
    const image = files.filter((file) => file.fieldname === "image");
    return image.length !== 0 ? image[0].filename : req.body.image; // The old image if none of the file match
  };

  // To get the model file inside all the uploaded files
  const getModel = (files) => {
    const model = files.filter((file) => file.fieldname === "model");
    return model.length !== 0 ? model[0].filename : req.body.model; // The old model if none of the file match
  };

  // To get the bgImage file inside all the uploaded files
  const getBgImage = (files) => {
    const bgImage = files.filter((file) => file.fieldname === "bgImage");
    return bgImage.length !== 0 ? bgImage[0].filename : req.body.bgImage; // The old bgImage if none of the file match
  };

  // To store old files if the files was not changed
  const image = getImage(req.files);
  const model = getModel(req.files);
  const bgImage = getBgImage(req.files);

  const values = [
    req.body.name,
    req.body.information,
    req.body.voiceID,
    image,
    model,
    bgImage,
    req.body.reference,
  ];
  con.query(sql, [...values, nbID], (err, result) => {
    if (err) return res.json({ Status: false, Error: "Query Error" + err });
    return res.json({ Status: true, Result: result });
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

router.delete("/delete_nb/:nbID", (req, res) => {
  const nbID = req.params.nbID;
  const sql = "delete from notablebatangueños where nbID = ?";
  con.query(sql, [nbID], (err, result) => {
    if (err) return res.json({ Status: false, Error: "Query Error" + err });
    return res.json({ Status: true, Result: result });
  });
});

router.get("/feedback", (req, res) => {
  const sql = "SELECT * FROM feedback";
  con.query(sql, (err, result) => {
    if (err) return res.json({ Status: false, Error: "Query Error" });
    return res.json({ Status: true, Result: result });
  });
});

router.delete("/delete_feedback/:feedbackID", (req, res) => {
  const feedbackID = req.params.feedbackID;
  const sql = "delete from feedback where feedbackID = ?";
  con.query(sql, [feedbackID], (err, result) => {
    if (err) return res.json({ Status: false, Error: "Query Error" + err });
    return res.json({ Status: true, Result: result });
  });
});

router.get("/logout", (req, res) => {
  res.clearCookie("token");
  return res.json({ Status: true });
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
        if (err) throw err;
        rewardPoint.username = visitor[0].username;
        results.push(rewardPoint);

        if (results.length === rewardPoints.length) {
          return res.json({ Status: true, Result: results });
        }
      });
    });
  });
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

// Get question by ID
router.get("/questions/:assessmentID", (req, res) => {
  const assessmentID = req.params.assessmentID;
  con.query(
    "SELECT * FROM assessment WHERE assessmentID = ?",
    assessmentID,
    (err, result) => {
      if (err) throw err;
      res.send(result[0]);
    }
  );
});

// Add a question
router.post("/questions", (req, res) => {
  const { question, choices } = req.body;

  con.query(
    "INSERT INTO assessment (question) VALUES (?)",
    question,
    (err, result) => {
      if (err) throw err;

      const assessmentID = result.insertId;

      choices.forEach((choice) => {
        con.query(
          "INSERT INTO question_choices (assessmentID, choice, isCorrectChoice) VALUES (?, ?, ?)",
          [assessmentID, choice.choice, choice.isCorrectChoice],
          (err, result) => {
            if (err) throw err;
          }
        );
      });

      res.json(assessmentID);
    }
  );
});

// Update a question
router.put("/questions/:assessmentID", (req, res) => {
  const assessmentID = req.params.assessmentID;
  const { question, choices } = req.body;

  con.query(
    "UPDATE assessment SET question = ? WHERE assessmentID = ?",
    [question, assessmentID],
    (err, result) => {
      if (err) throw err;

      con.query(
        "DELETE FROM question_choices WHERE assessmentID = ?",
        assessmentID,
        (err, result) => {
          if (err) throw err;

          choices.forEach((choice) => {
            con.query(
              "INSERT INTO question_choices (assessmentID, choice, isCorrectChoice) VALUES (?, ?, ?)",
              [assessmentID, choice.choice, choice.isCorrectChoice],
              (err, result) => {
                if (err) throw err;
              }
            );
          });

          res.send("Question updated successfully");
        }
      );
    }
  );
});

// Delete a question
router.delete("/questions/:assessmentID", (req, res) => {
  const assessmentID = req.params.assessmentID;

  con.query(
    "DELETE FROM question_choices WHERE assessmentID = ?",
    assessmentID,
    (err, result) => {
      if (err) throw err;

      con.query(
        "DELETE FROM assessment WHERE assessmentID = ?",
        assessmentID,
        (err, result) => {
          if (err) throw err;
          res.send("Question deleted successfully");
        }
      );
    }
  );
});

export { router as adminRouter };
