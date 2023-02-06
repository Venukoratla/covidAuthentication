const express = require("express");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const app = express();

app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const connection = async (request, response) => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Connected");
    });
  } catch (e) {
    console.log(`DB ERROR! ${e.message}`);
  }
};

connection();

//convertion
const convertToCamel = (object) => {
  return {
    stateId: object.state_id,
    stateName: object.state_name,
    population: object.population,
  };
};

const convert = (object) => {
  return {
    districtId: object.district_id,
    districtName: object.district_name,
    stateId: object.state_id,
    cases: object.cases,
    cured: object.cured,
    active: object.active,
    deaths: object.deaths,
  };
};

//MwFunction
const checking = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "abcdefgh", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//LOGIN
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const userQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(userQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isCorrectPassword = await bcrypt.compare(password, dbUser.password);
    if (isCorrectPassword) {
      const payload = {
        username: username,
      };
      const jwtToken = await jwt.sign(payload, "abcdefgh");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//GET STATES
app.get("/states/", checking, async (request, response) => {
  const statesQuery = `SELECT * FROM state;`;
  const stateArray = await db.all(statesQuery);
  response.send(stateArray.map((eachState) => convertToCamel(eachState)));
});

// GET STate
app.get("/states/:stateId/", checking, async (request, response) => {
  const { stateId } = request.params;
  const stateQuery = `SELECT * FROM state WHERE state_id = ${stateId};`;
  const stateArr = await db.get(stateQuery);
  response.send(convertToCamel(stateArr));
});

//POST District

app.post("/districts/", checking, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const distQuery = `INSERT INTO district ( district_name , state_id, cases, cured, active, deaths) 
    VALUES (
        '${districtName}',
        ${stateId},
        ${cases},
        ${cured},
        ${active},
        ${deaths}
    );`;

  const district = await db.run(distQuery);
  response.send("District Successfully Added");
});

//GET District
app.get("/districts/:districtId", checking, async (request, response) => {
  const { districtId } = request.params;
  const getDistrictQuery = `SELECT * FROM district WHERE district_id = ${districtId};`;
  const districtArray = await db.get(getDistrictQuery);
  response.send(convert(districtArray));
});

//DELETE District
app.delete("/districts/:districtId", checking, async (request, response) => {
  const { districtId } = request.params;
  const deleteQuery = `DELETE FROM district WHERE district_id = ${districtId};`;
  await db.run(deleteQuery);
  response.send("District Removed");
});

//UPDATE district
app.put("/districts/:districtId", checking, async (request, response) => {
  const { districtId } = request.params;
  const details = request.body;
  const { districtName, stateId, cases, cured, active, deaths } = details;
  const updateQuery = `UPDATE district 
    SET district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths}
    WHERE district_id = ${districtId};`;

  await db.run(updateQuery);
  response.send("District Details Updated");
});

//GET total
app.get("/states/:stateId/stats/", checking, async (request, response) => {
  const { stateId } = request.params;
  const getQuery = `SELECT SUM(cases) AS totalCases,
    SUM(cured) AS totalCured,
    SUM(active) AS totalActive,
    SUM(deaths) AS totalDeaths
    FROM district WHERE state_id = ${stateId};`;
  const totalArr = await db.get(getQuery);
  response.send(totalArr);
});

module.exports = app;
