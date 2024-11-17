import express from "express";
import con from "../utils/db.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { exec } from "child_process";
import { promises as fs } from "fs";
import OpenAI from "openai";
import ElevenLabs from "elevenlabs-node";
import path from "path";

const router = express.Router();
dotenv.config();
console.log("OPENAI_API_KEY:", process.env.OPENAI_API_KEY);
console.log("ELEVENLABS_API_KEY:", process.env.ELEVENLABS_API_KEY);
console.log("DEFAULT_VOICE_ID:", process.env.DEFAULT_VOICE_ID);
// Pre-Trained Model
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Text-To-Speech
const voice = new ElevenLabs({
  apiKey: process.env.ELEVENLABS_API_KEY, // Your API key from Elevenlabs
  voiceId: process.env.DEFAULT_VOICE_ID, // A Voice ID from Elevenlabs
});
router.post("/chat_nb", async (req, res) => {
  const { prompt, nb, visitorID, chat } = req.body;
  
  try {
    // Analyse message and get response
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: prompt,
      temperature: 1,
      max_tokens: 100,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    if (!completion || !completion.choices || completion.choices.length === 0) {
      throw new Error('No valid response from OpenAI');
    }

    const message = completion.choices[0].message.content; // The text to convert to speech

    //_____________________TURN OFF ELEVENLABS HERE___________________________
    try {
      await voice.textToSpeech({
        fileName: "Public/Audios/message_audio.mp3", 
        textInput: message, 
        voiceId: nb.voiceID, 
        stability: 0.5, 
        similarityBoost: 0.75, 
        modelId: "eleven_multilingual_v2", 
        style: 0, 
        speakerBoost: true, 
      });
    } catch (error) {
      console.error("Error in text-to-speech conversion:", error);
      throw new Error('Failed to convert text to speech');
    }
    //_____________________________ENDS HERE___________________________________

    // Generate lipsync
    try {
      await lipSyncMessage();
    } catch (error) {
      console.error("Error in lipSyncMessage:", error);
      throw new Error('Failed to generate lipsync');
    }

    const fileName = "Public/Audios/message_audio.mp3";
    const audio = await audioFileToBase64(fileName);

    // Read lipsync data from JSON
    let lipsync;
    try {
      lipsync = await readJsonTranscript("Public/Audios/message_audio.json");
    } catch (error) {
      console.error("Error reading lipsync JSON:", error);
      throw new Error('Failed to read lipsync JSON');
    }

    const response = { message: message, audio: audio, lipsync: lipsync };

    // Insert into database
    const query =
      "INSERT INTO visitor_chats (visitorID, chat, nb, response) VALUES (?, ?, ?, ?)";
    con.query(query, [visitorID, chat, nb.name, message], (err, results) => {
      if (err) {
        console.error("Database insert error:", err);
        return res.status(500).send('Database error');
      }
      res.send(response);
    });
    
  } catch (err) {
    console.error("Error during processing:", err); // Log full error
    res.status(500).send({
      message: "An error occurred during processing",
      error: err.message || err,
    });
  }
});


// For NB speaking pattern
const lipSyncMessage = async () => {
  await execCommand(
    "ffmpeg -y -i Public\\Audios\\message_audio.mp3 Public\\Audios\\message_audio.wav"
    // -y to overwrite the file
  );
  
  // -r phonetic is faster but less accurate
};

const execCommand = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) reject(error);
      resolve(stdout);
    });
  });
};

const readJsonTranscript = async (file) => {
  const data = await fs.readFile(file, "utf8");
  return JSON.parse(data);
};

const audioFileToBase64 = async (file) => {
  const data = await fs.readFile(file);
  return data.toString("base64");
};




































// Import bcrypt for password hashing
 // Import bcrypt

 router.get("/users", (req, res) => {
  const sql = "SELECT visitorID, username FROM visitor";
  con.query(sql, (err, result) => {
    if (err) return res.status(500).json({ Status: false, Error: "Query Error" });
    return res.json({ Status: true, Users: result });
  });
});




// Get a user's information by visitorID
router.get("/users/:visitorID", (req, res) => {
  const visitorID = req.params.visitorID;
  const sql = "SELECT visitorID, username FROM visitor WHERE visitorID = ?";
  con.query(sql, [visitorID], (err, result) => {
    if (err) return res.status(500).json({ Status: false, Error: "Query Error" });
    if (result.length === 0) return res.status(404).json({ Status: false, Error: "User not found" });
    return res.json({ Status: true, User: result[0] });
  });
});

// Update a user's information by visitorID (username or password)
router.put("/users/:visitorID", (req, res) => {
  const visitorID = req.params.visitorID;
  const { username, password } = req.body;

  const sql = `UPDATE visitor SET username = ?, password = ? WHERE visitorID = ?`;
  con.query(sql, [username, password, visitorID], (err, result) => {
    if (err) return res.status(500).json({ Status: false, Error: "Query Error" });
    if (result.affectedRows === 0) return res.status(404).json({ Status: false, Error: "User not found" });
    return res.json({ Status: true, Message: "User updated successfully" });
  });
});

// Delete a user by visitorID
router.delete("/users/:visitorID", (req, res) => {
  const visitorID = req.params.visitorID;
  const sql = "DELETE FROM visitor WHERE visitorID = ?";
  con.query(sql, [visitorID], (err, result) => {
    if (err) return res.status(500).json({ Status: false, Error: "Query Error" });
    if (result.affectedRows === 0) return res.status(404).json({ Status: false, Error: "User not found" });
    return res.json({ Status: true, Message: "User deleted successfully" });
  });
});



// Backend example for getting leaderboard (ordering by totalPoints descending)
router.get("/reward_points/leaderboard", (req, res) => {
  const sql = `
    SELECT *
    FROM reward_points 
    JOIN visitor ON reward_points.visitorID = visitor.visitorID 
    ORDER BY totalPoints DESC
  `;
  
  con.query(sql, (err, result) => {
    console.error('Database query error:', err);
    if (err) return res.status(500).json({ Status: false, Error: "Query Error" });
    return res.json(result);
  });
});




// GET: Retrieve reward points for a specific visitor or all visitors
router.get("/reward_points/:visitorID?", (req, res) => {
  const visitorID = req.params.visitorID;

  // If visitorID is provided, fetch points for that user, otherwise fetch all
  const sql = visitorID
    ? "SELECT * FROM reward_points WHERE visitorID = ?"
    : "SELECT * FROM reward_points";

  con.query(sql, visitorID ? [visitorID] : [], (err, result) => {
    if (err) return res.status(500).json({ Status: false, Error: "Query Error" });
    if (result.length === 0) return res.status(404).json({ Status: false, Error: "No reward points found" });
    return res.json({ Status: true, RewardPoints: result });
  });
});

// PUT: Update reward points for a specific rewardPointID
router.put("/reward_points/:rewardPointID", (req, res) => {
  const rewardPointID = req.params.rewardPointID;
  const { totalPoints } = req.body;

  if (!totalPoints) {
    return res.status(400).json({ Status: false, Error: "Total points are required" });
  }

  const sql = "UPDATE reward_points SET totalPoints = ? WHERE rewardPointID = ?";
  con.query(sql, [totalPoints, rewardPointID], (err, result) => {
    if (err) return res.status(500).json({ Status: false, Error: "Query Error" });
    if (result.affectedRows === 0) return res.status(404).json({ Status: false, Error: "Reward points not found" });
    return res.json({ Status: true, Message: "Reward points updated successfully" });
  });
});

// DELETE: Delete reward points by rewardPointID
router.delete("/reward_points/:rewardPointID", (req, res) => {
  const rewardPointID = req.params.rewardPointID;

  const sql = "DELETE FROM reward_points WHERE rewardPointID = ?";
  con.query(sql, [rewardPointID], (err, result) => {
    if (err) return res.status(500).json({ Status: false, Error: "Query Error" });
    if (result.affectedRows === 0) return res.status(404).json({ Status: false, Error: "Reward points not found" });
    return res.json({ Status: true, Message: "Reward points deleted successfully" });
  });
});

export { router as rewardPointsRouter };










































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

  
    const username = decoded.username; // Assuming username is in the token
    const password = decoded.password; // Assuming password is in the token

    // Check if the visitor already exists
    const sql = "SELECT * FROM visitor WHERE username = ?";

    
    con.query(sql, [username], (err, result) => {
      if (err) return res.json({ loginStatus: false, Error: "Query error1" });

      if (result.length > 0) {
        const visitorID = result[0].visitorID; // Access the visitorId field
        // Visitor exists, log them in
        console.log(visitorID);
        const query = "INSERT INTO visitor_logins (visitorID) VALUES (?)";
        
        con.query(query, [visitorID], (err, results) => {
          if (err) return res.json({ loginStatus: false, Error: "Query error2" });

          res.cookie("token", token); // Set token in cookie if needed
          return res.json({ status: 200, loginStatus: true, visitorID });
        });
      } else {
        // Visitor does not exist, create a new record
        // Use the hashed password from the token directly
        const insertSql = "INSERT INTO visitor (username, `password`,`role`) VALUES (?, ?,'user')";
        con.query(insertSql, [username, password], (err, insertResult) => { // Use `password` directly
          if (err) return res.json({ loginStatus: false, Error: "Query error3" });

          // Now log in the newly created visitor
          const query = "INSERT INTO visitor_logins (visitorID) VALUES (?)";
          const newVisitorID = insertResult.insertId; // Get the ID of the newly inserted visitor

          con.query(query, [newVisitorID], (err, results) => {
            if (err) return res.json({ loginStatus: false, Error: "Query error4" });

            res.cookie("token", token); // Set token in cookie if needed
            return res.json({ status: 200,loginStatus: true, visitorID: newVisitorID });
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
