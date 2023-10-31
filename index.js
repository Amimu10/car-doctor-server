const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
require("dotenv").config();
const app = express();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const port = process.env.PORT || 5000;

// middleware
app.use(cors({
   origin: [
        "http://localhost:5173"
   ],
   credentials: true 
}));
app.use(express.json());
app.use(cookieParser()); 

// car-doctors
// fEPw8Yn8OeShgAL0
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1lciteo.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// middlewares
const logger = (req, res, next) => {
   console.log("log: info " , req?.method, res?.url);  
   next();  
}

const verifyToken = (req, res, next) => {
    const token = req?.cookies?.token; 
    console.log("token in the middleware", token); 
    if(!token){
      return res.status(401).send({message: "unauthorized access"}) 
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
        if(error){
          return res.status(401).send({message: "unauthorized access"})
        }
        req.user = decoded; 
        next(); 
    })
    // next();  
}


async function run() {
  try {
    await client.connect();

    const serviceCollection = client.db("cardoctor").collection("services");
    const bookingCollection = client.db("cardoctor").collection("bookings");

   app.post("/jwt", logger, async(req, res) => {
       const user = req.body;
       console.log("user for token", user);
       const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: "1hr"}) 
       res.cookie("token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "none" 
     })
     .send({success: true});   
   })

  app.post("/logout", async(req, res) => {
      const user = req.body;
      res.clearCookie("token", {maxAge: 0}).send({success: true}) 
  })

    app.get("/services", async (req, res) => {
      const cursor = serviceCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const options = {
        projecttion: { title: 1, price: 1, service_id: 1, img: 1 },
      };
      const result = await serviceCollection.findOne(query, options);
      res.send(result);
    });

    // bookings

    app.get("/bookings", logger, verifyToken, async (req, res) => {
      console.log(req.query.email);
      console.log("token owner info", req.user);
      if(req.user?.email !== req.query.email) {
        return res.status(403).send({ message: "forbidden access"})
      }
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email }; 
      }
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      console.log(booking);
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });

    app.patch("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)} 
       const updateBooking = req.body;
       console.log(updateBooking); 
       const updateDoc = {
          $set: {
             status: updateBooking.status 
          },
       }
      const result = await bookingCollection.updateOne(filter, updateDoc); 
      res.send(result);
    }) 

    app.delete("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Crud is running...");
});

app.listen(port, () => {
  console.log(`car-doctor is Running on port ${port}`);
});
