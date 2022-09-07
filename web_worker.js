const hash = require("./hash");
const pageDict = require("./page-dict.json");
const express = require("express");
const cookieParser = require('cookie-parser')
const fs = require("fs");
const EventEmitter = require("events");

class web_worker extends EventEmitter
{
	constructor(port)
	{
		super();
		this.port = port || 3000;
		this.directory = `${__dirname}/pages/`;
		console.log("Starting WebServer");
		this.agent = express();
		this.agent.use(express.json());
		this.agent.use(cookieParser());
		this.agent.get("/static/*", (req, res) => {
			res.sendFile(this.directory+req.originalUrl, (err) => {
				res.status(404).send();
			});
		});

		this.agent.get("*", (req, res, next) => {
			if (req.headers['x-forwarded-proto'] == "http")
				res.status(101).redirect(`https://${req.headers['host']}${req.originalUrl}`);
			else
				next();
		});

		this.agent.get("/favicon.ico", (req, res) => { res.sendFile(`${this.directory}static/favicon.ico`, (err) => {if(err){ res.status(404).send(); console.log(err); }}); });

		this.agent.get("/login", (req, res) => {
			if (req.cookies['ft_intra_code'])
			{
				res.redirect("");
			}
			else
			{
				// Get AuthCode
				const params = new URLSearchParams();
				const state = `${hash(`${Math.random()}${hash(new Date().toDateString())}${Math.random()}`)}`;

				params.append("client_id", `${process.env['ft_client_id']}`);
				params.append("redirect_uri", `${req.headers['x-forwarded-proto'] || req.protocol}://${req.headers['host']}/oauth/code`);
				params.append("scope", `public forum`);
				params.append("response_type", `code`);
				params.append("state", `${state}`);

				res.cookie("ft_token_state", `${state}`)
					.redirect(`https://api.intra.42.fr/oauth/authorize?${params.toString()}`);
			}
		});

		this.agent.get("/oauth", (i, o) => {o.redirect("/");});
		this.agent.get("/oauth/code", (i, o) => {
			const params = new URLSearchParams(i.originalUrl.slice(i.originalUrl.indexOf("?")));
			if (params.get("state") == i.cookies['ft_token_state'])
			{
				if (params.get("code") != 'j%3Anull')
				{
					o.status(200).cookie("ft_intra_code").send("valid state and code looks good");
				}
				else
				{
					o.status(401).send("valid state but code is not provided");
				}
			}
			else
				o.status(400).send("invalid state");
		});
		this.agent.get("/oauth/err", (i, o) => {
			const params = new URLSearchParams(i.originalUrl.slice(i.originalUrl.indexOf("?")));
			var errorResponse = {};
			switch (params.get("code"))
			{
				case "BAD_STATE":
					errorResponse = {
						err: "BAD_STATE",
						message: "There is some miscommunication between Server and Client, please try again",
						allowRetry: true
					};
					break;
				case "UNAUTHORISED":
					errorResponse = {
						err: "UNAUTHORISED",
						message: "You will need to authorise ft-mentor to continue.",
						allowRetry: true
					};
					break;
				case "DEV_SKILL_DIFF":
					errorResponse = {
						err: "DEV_SKILL_DIFF",
						message: `We are sorry but our DEVs are being lazy.<br>open an issue @ <a href="https://github.com/IsCoffeeTho/ft-mentor/issues/new">github.com/IsCoffeeTho/ft-mentor/issues/new</a>`,
						allowRetry: true
					};
					break;
				default:
					errorResponse = {
						err: "UNKNOWN",
						message: `The err code provided is invalid.<br>open an issue @ <a href="https://github.com/IsCoffeeTho/ft-mentor/issues/new">github.com/IsCoffeeTho/ft-mentor/issues/new</a>`,
						allowRetry: true
					};
					break;
			}
			fs.readFile(`${this.directory}oauth/err.html`, (err, data) => {
				if (!err)
					o.send(data.toString().replace(/\{\{\s*([^}]+)\s*\}\}/g, (m, s) => {
						switch (s)
						{
							case "err:code": return (errorResponse.err || "DEV_SKILL_DIFF");
							case "err:message": return (errorResponse.message || "If you are seeing this, glhf!");
							default: return "";
						}
					}));
				else
					o.status(500).type("text/plain").send(`500 Internal Server ERR: ${err.code}`);
			});
		});
		this.agent.get("/oauth/*", (i, o) => {
			o.send();
		});

		this.agent.get("/", (req, res) => {
			fs.readFile(`${this.directory}wrapper.html`, (err, wrp) => {
				if (!err)
				{
					fs.readFile(`${this.directory}init.html`, (err, data) => {
						if (!err)
							res.send(wrp.toString().replace(/\{\{\s*([^{]+)\s*\}\}/g, (m, g) => {
								switch (g)
								{
									case "page": return (data.toString());
									default: return "";
								}
							}));
						else
							res.status(500).send(`500 Internal Server Error: ${err.code}`);
					});
				}
				else
					res.status(500).send(`500 Internal Server Error: ${err.code}`);
			});
		});

		this.agent.get("/app/*", (req, res) => {
			var url = req.originalUrl.replace(/\?.*$/g, "").replace(/^\/app/g, "");
			fs.readFile(`${this.directory}${pageDict[url]}`, (err, data) => {
				if (!err)
					res.send(data.toString());
				else
				{
					if (err.code == "ENOENT")
					{
						res.status(404).sendFile(`${this.directory}404.html`, (err) => {
							if (err)
								res.status(500).type("text/plain").send(`500 Internal Server ERR: ${err.code}`);
						});
					}
					else
						res.status(500).type("text/plain").send(`500 Internal Server ERR: ${err.code}`);
				}
			});
		});

		this.agent.get("/*", (req, res) => {
			var url = req.originalUrl.replace(/\?.*$/g, "");
			fs.readFile(`${this.directory}wrapper.html`, (err, wrp) => {
				if (!err)
				{
					if (pageDict[url])
					{
						fs.readFile(`${this.directory}${pageDict[req.originalUrl.replace(/\?.*$/g, "")]}`, (err, data) => {
							if (!err)
								res.send(wrp.toString().replace("{{page}}", data.toString()));
							else
								res.status(500).send(`500 Internal Server Error: ${err.code}`);
						});
					}
					else
					{
						fs.readFile(`${this.directory}/404.html`, (err, data) => {
							if (!err)
								res.status(404).send(wrp.toString().replace("{{page}}", data.toString()));
							else
								res.status(500).send(`500 Internal Server Error: ${err.code}`);
						});
					}
				}
				else
					res.status().send(`500 Internal Server Error: ${err.code}`);
			});
		});

		this.agent.post("/", (req, res) => {
			var url = req.originalUrl.replace(/\?.*$/g, "").replace(/^\/app/g, "");
			fs.readFile(`${this.directory}${pageDict[url]}`, (err, data) => {
				if (!err)
					res.send(data.toString());
				else
					res.status(500).send(`500 Internal Server Error: ${err.code}`);
			});
		});

		try {
			this.agent.listen(this.port, () => {
				this.emit('ready');
			});
		}
		catch (e)
		{
			this.emit('fatal', e);
		}
	}
}

module.exports = web_worker;