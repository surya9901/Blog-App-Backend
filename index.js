const port = process.env.PORT || 5000;

const express = require('express')
const app = express()
app.use(express.json())

const mongodb = require('mongodb')
const mongoClient = mongodb.MongoClient
const url = process.env.DB || "mongodb://localhost:27017"

const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");

const dotenv = require("dotenv");
dotenv.config();

const cors = require('cors')
app.use(cors({
    origin: "*"
}))

const nodemailer = require('nodemailer');

function authenticate(req, res, next) {
    try {
        if (req.headers.authorization) {
            jwt.verify(req.headers.authorization, process.env.JWT_SECRET, (error, decoded) => {
                if (error) {
                    res.status(401).json({
                        message: "Unauthorized"
                    })
                } else {
                    req.userid = decoded.id
                    next()
                }
            })
        } else {
            res.status(401).json({
                message: "No Token Present"
            })
        }
    } catch (error) {
        res.status(500).json({
            message: "Something went wrong"
        })
    }
}

app.post("/register", async (req, res) => {
    try {
        let client = await mongoClient.connect(url)
        let db = client.db("Dev_Blog")
        let duplicate_email = await db.collection("users").findOne({ "email": `${req.body.email}` })
        if (duplicate_email) {
            await client.close()
            res.status(204).json({
                message: "Duplicate Entry"
            })
        } else {
            // Hashing the password
            let salt = bcryptjs.genSaltSync(10);
            let hash = bcryptjs.hashSync(req.body.password, salt);
            req.body.password = hash;
            let data = await db.collection("users").insertOne(req.body)
            await client.close()
            res.json({
                message: "User Created",
                id: data._id
            })
        }
    } catch (error) {
        res.status(500).json({
            message: "something went wrong"
        })
    }
})

app.post('/login', async (req, res) => {
    try {
        let client = await mongoClient.connect(url)
        let db = client.db("Dev_Blog")
        let user = await db.collection("users").findOne({ email: req.body.email })
        if (user) {
            let matchpassword = bcryptjs.compareSync(req.body.password, user.password)
            if (matchpassword) {
                let token = jwt.sign({ id: user._id }, process.env.JWT_SECRET)
                res.json({
                    message: "Logged in!",
                    token
                })
            } else {
                res.status(400).json({
                    message: "Username/Password incorrect"
                })
            }
        } else {
            res.status(400).json({
                message: "Username/Password incorrect"
            })
        }
    } catch (error) {
        res.status(500).json({
            message: 'Something went wrong'
        })
    }
})

app.post("/post-blog", [authenticate], async (req, res) => {
    try {
        let client = await mongoClient.connect(url)
        let db = client.db("Dev_Blog")
        req.body.userid = req.userid
        await db.collection("Content").insertOne(req.body)
        await client.close()
        res.json({
            message: "Blog Posted Successfully"
        })
    } catch (error) {
        res.status(500).json({
            message: "something went wrong"
        })
    }
})

app.get("/blogs", async (req, res) => {
    try {
        let client = await mongoClient.connect(url)
        let db = client.db("Dev_Blog")
        let data = await db.collection("Content").find().toArray()
        await client.close()
        res.json(data)
    } catch (error) {
        res.status(500).json({
            message: "something went wrong"
        })
    }
})

app.get("/view-blog", async (req, res) => {
    try {
        let client = await mongoClient.connect(url)
        let db = client.db("Dev_Blog")
        let data = await db.collection("Content").find({ _id: mongodb.ObjectId(req.query.q) }).toArray()
        await client.close()
        res.json(data)
    } catch (error) {
        res.status(500).json({
            message: "something went wrong"
        })
    }
})

app.get("/userName", async (req, res) => {
    try {
        let client = await mongoClient.connect(url)
        let db = client.db("Dev_Blog")
        let data = await db.collection("users").find({ _id: mongodb.ObjectId(req.query.q) }).toArray()
        await client.close()
        res.json(data)
    } catch (error) {
        res.status(500).json({
            message: "something went wrong"
        })
    }
})

app.get("/myblogs", [authenticate], async (req, res) => {
    try {
        let client = await mongoClient.connect(url)
        let db = client.db("Dev_Blog")
        let data = await db.collection("Content").find({ userid: req.userid }).toArray()
        await client.close()
        res.json(data)
    } catch (error) {
        res.status(500).json({
            message: "something went wrong"
        })
    }
})

app.put("/edit-post/:id", [authenticate], async (req, res) => {
    try {
        let client = await mongoClient.connect(url)
        let db = client.db("Dev_Blog")
        await db.collection("Content").updateMany({ _id: { $eq: mongodb.ObjectId(req.params.id) } }, { $set: { "title": `${req.body.title}`, "content": `${req.body.content}` } })
        await client.close()
        res.json({
            message: "Edited Successfully"
        })
    } catch (error) {
        res.status(500).json({
            message: "Something went wrong"
        })
    }
})

const contactEmail = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: `${process.env.USER_NAME}`,
        pass: `${process.env.PASSWORD}`,
    },
});

contactEmail.verify((error) => {
    if (error) {
        console.log(error);
    } else {
        console.log("Ready to Send");
    }
});

app.post("/forgot-password-email", async (req, res) => {
    let resetPin = (Math.floor(100000 + Math.random() * 900000))
    try {
        let client = await mongoClient.connect(url)
        let db = client.db("Dev_Blog")
        let data = await db.collection("users").findOneAndUpdate({ email: req.query.q }, { $set: { PIN: resetPin } })
        if (data.value) {
            const message = resetPin;
            const mail = {
                from: `Dev Blog <${process.env.USER_NAME}>`,
                to: req.query.q,
                subject: "Dev Blog Password Reset OTP",
                html:
                    `<h2>Hi User, This is your reset pin ${message}</h2>`
            };
            contactEmail.sendMail(mail, (error) => {
                if (error) {
                    res.json({ status: "ERROR" });
                } else {
                    res.json({ status: "Message Sent" });
                }
            });
            await client.close()
        } else {
            res.status(404).json({
                message: "No user Found!"
            })
        }
    } catch (error) {
        res.status(500).json({
            message: "No user ID found"
        })
    }
});

app.post("/verify-otp", async (req, res) => {
    try {
        const client = await mongoClient.connect(url)
        const db = client.db("Dev_Blog")
        const data = await db.collection("users").findOne({ email: req.body.email })
        if (data) {
            if (data.PIN == req.body.PIN) {
                await db.collection("users").findOneAndUpdate({ email: data.email }, { $set: { PIN: "" } })
                await client.close()
                res.json({
                    message: "Success"
                })
            } else {
                res.status(402).json({
                    message: "Invalid OTP"
                })
            }
        } else {
            res.status(500).json({
                message: "To much Traffic"
            })
        }
    } catch (error) {
        res.status(500).json({
            message: "To much Traffic"
        })
    }
})

app.post("/new-pass-word", async (req, res) => {
    try {
        let client = await mongoClient.connect(url)
        let db = client.db("Dev_Blog")
        let data = await db.collection("users").findOne({ "email": `${req.body.email}` })
        if (data) {
            let salt = bcryptjs.genSaltSync(10);
            let hash = bcryptjs.hashSync(req.body.password, salt);
            req.body.password = hash;
            await db.collection("users").findOneAndUpdate({ email: data.email }, { $set: { password: req.body.password } })
            await client.close()
            res.json({
                message: "Password updated",
            })
        } else {
            await client.close()
            res.status(500).json({
                message: "Something went wrong"
            })
        }
    } catch (error) {
        res.status(500).json({
            message: "something went wrong"
        })
    }
})

app.delete("/delete-blog", [authenticate], async (req, res) => {
    try {
        let client = await mongoClient.connect(url)
        let db = client.db("Dev_Blog")
        await db.collection("Content").deleteOne({ _id: { $eq: mongodb.ObjectId(req.query.q) } })
        await client.close()
        res.json({
            message: "Deleted Successfully"
        })
    } catch (error) {
        res.status(500).json({
            message: "Something went wrong"
        })
    }
})

app.listen(port, () => {
    console.log(`Server is up and running in ${port}`)
})