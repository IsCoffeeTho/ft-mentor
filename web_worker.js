const hash = require("./hash");
const pageDict = require("./page-dict.json");
const express = require("express");
const cookieParser = require('cookie-parser')
const fs = require("fs");
const EventEmitter = require("events");
const { URLSearchParams } = require("url");

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
			// Get AuthCode
			const params = new URLSearchParams();
			const state = `${hash(`${Math.random()}${hash(new Date().toDateString())}${Math.random()}`)}`;

			params.append("client_id", `${process.env['ft_client_id']}`);
			params.append("redirect_uri", `${req.headers['x-forwarded-proto'] || req.protocol}://${req.headers['host']}/oauth/code`);
			params.append("scope", `public forum`);
			params.append("response_type", `code`);
			params.append("state", `${state}`);

			res.cookie("ft_state", `${state}`)
				.redirect(`https://api.intra.42.fr/oauth/authorize?${params.toString()}`);
		});

		this.agent.get("/oauth", (i, o) => {o.redirect("/");});
		this.agent.get("/oauth/code", (i, o) => {
			const params = new URLSearchParams(i.originalUrl.slice(i.originalUrl.indexOf("?")));
			if (params.get("state") == i.cookies['ft_state'])
			{
				o.clearCookie("ft_state");
				if (params.get("code"))
				{
					o.status(200).cookie("ft_intra_code", params.get("code")).redirect("/oauth/token");
				}
				else
				{
					o.status(401).redirect("/oauth/err?code=UNAUTHORISED");
				}
			}
			else
				o.redirect("/oauth/err?code=BAD_STATE");
		});
		this.agent.get("/oauth/token", (i, o) => {
			if (i.cookies['ft_intra_code'])
			{
				const form = new FormData();
				const state = `${hash(`${Math.random()}${hash(new Date().toDateString())}${Math.random()}`)}`;

				form.append("grant_type", `authorization_code`);
				form.append("client_id", `${process.env['ft_client_id']}`);
				form.append("client_secret", `${process.env['ft_client_secret']}`);
				form.append("code", `${i.cookies['ft_intra_code']}`);
				form.append("redirect_uri", `${i.headers['x-forwarded-proto'] || i.protocol}://${i.headers['host']}/oauth/code`);
				form.append("state", `${state}`);

				// form.forEach((v, k) => {
				// 	console.log(`${k}: ${v}`)
				// });
				fetch("https://api.intra.42.fr/oauth/token",{
					method: 'POST',
					body: form
				}).then((response) => {
					response.json().then((data) => {
						if (data['error'])
						{
							o.clearCookie("ft_intra_code");
							switch (data['error'])
							{
								case "invalid_grant":
									o.redirect("/oauth/err?code=INVALID_GRANT");
									break;
								default:
									o.redirect("/oauth/err?code=DEV_SKILL_DIFF");
									break;
							}
						}
						else
						{
							o.redirect("/panel");
							/*

							// There is a problem with the API where the state is not accompanied with the response so we are skipping it untill it's fixed

							if (data['state'] == state)
							{
								o.redirect("/oauth/err?code=DEV_SKILL_DIFF");
							}
							else
							{
								o.redirect("/oauth/err?code=BAD_STATE");
							}
							*/
						}
					}).catch((reason) => {
						console.log("parse:", reason);
						o.redirect("/oauth/err?code=DEV_SKILL_DIFF");
					});
				}).catch((err) => {
					console.log("fetch:", err);
					o.redirect("/oauth/err?code=DEV_SKILL_DIFF");
				});
			}
			else
				o.redirect("/login");
		});
		this.agent.get("/oauth/err", (i, o) => {
			const params = new URLSearchParams(i.originalUrl.slice(i.originalUrl.indexOf("?")));
			var errorResponse = {};
			switch (params.get("code"))
			{
				case "BAD_STATE":
					errorResponse = {
						err: "BAD_STATE",
						message: "There is some miscommunication between Server and Client, Please open an issue if this persists.",
						allowRetry: true,
						allowIssue: true
					};
					break;
				case "INVALID_GRANT":
					errorResponse = {
						err: "INVALID_GRANT",
						message: "The grant provided from the server doesn't match what we believed.",
						allowRetry: true,
						allowIssue: true
					};
					break;
				case "UNAUTHORISED":
					errorResponse = {
						err: "UNAUTHORISED",
						message: "You will need to authorise ft-mentor to continue.",
						allowRetry: true,
						allowIssue: false
					};
					break;
				case "DEV_SKILL_DIFF":
					errorResponse = {
						err: "DEV_SKILL_DIFF",
						message: `We are sorry but our DEVs are being lazy. Please open an issue`,
						allowRetry: true,
						allowIssue: true
					};
					break;
				default:
					errorResponse = {
						err: "UNKNOWN",
						message: `The err code provided is invalid. Please open an issue`,
						allowRetry: true,
						allowIssue: true
					};
					break;
			}
			fs.readFile(`${this.directory}oauth/err.html`, (err, data) => {
				if (!err)
					o.send(data.toString().replace(/\{\{\s*([^}]+)\s*\}\}/g, (m, s) => {
						switch (s)
						{
							case "err:code": return (errorResponse.err || "DEV_SKILL_DIFF");
							case "err:message": return (errorResponse.message || "If you are seeing this, glhf!")
								.replace(/\n/g, "<br>")
								.replace(/(https:\/\/[^ ]+)/g, (m, l) => {
									return `<a href="${l}">${l}</a>`;
								});
							case "err:issue": return (errorResponse.allowIssue ? `<a href="https://github.com/IsCoffeeTho/ft-mentor/issues/new?title=${params.get("code")}"><button>Open Issue</button></a>` : "");
							case "err:retry": return (errorResponse.allowRetry ? `<a href="/login"><button>Retry Login</button></a>` : "");
							default: return "";
						}
					}));
				else
					o.status(500).type("text/plain").send(`500 Internal Server ERR: ${err.code}`);
			});
		});
		this.agent.get("/oauth/*", (i, o) => {
			o.redirect("/");
		});

		this.agent.get("/", (req, res) => {
			res.status(404).sendFile(`${this.directory}init.html`, (err) => {
				if (err)
					res.status(500).type("text/plain").send(`500 Internal Server ERR: ${err.code}`);
			});
		});

		this.agent.get("/panel/err", (req, res) => {
			const params = new URLSearchParams(req.originalUrl.slice(req.originalUrl.indexOf("?")));
			var errorResponse = {};
			switch (params.get("code"))
			{
				case "UNAUTHORISED":
					errorResponse = {
						err: "UNAUTHORISED",
						message: `You haven't been assigned as a mentor for your campus`
					};
					break;
				default:
					errorResponse = {
						err: "UNKNOWN",
						message: `The err code provided is invalid. Please open an issue`
					};
					break;
			}
			fs.readFile(`${this.directory}oauth/err.html`, (err, data) => {
				if (!err)
					res.send(data.toString().replace(/\{\{\s*([^}]+)\s*\}\}/g, (m, s) => {
						switch (s)
						{
							case "err:code": return (errorResponse.err || "DEV_SKILL_DIFF");
							case "err:message": return (errorResponse.message || "If you are seeing this, glhf!")
							default: return "";
						}
					}));
				else
					o.status(500).type("text/plain").send(`500 Internal Server ERR: ${err.code}`);
			});
		});

		this.agent.get("/raw/*", (req, res) => {
			var url = req.originalUrl.replace(/\?.*$/g, "").replace(/^\/app/g, "");
			fs.readFile(`${this.directory}${pageDict[url]}`, (err, data) => {
				if (!err)
				{
					res.send(data.toString());
				}
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
							{
								res.send(wrp.toString()
									.replace("{{page}}", data.toString()
										.replace(/\{\{\s*([^}]+)\s*\}\}/g, (m, s) => {
											switch (s)
											{
												case "intra:user": return ("marvin");
												case "intra:campus": return ("42 Paris");
												default: return "";
											}
										})
									)
								);
							}
							else
								res.status(500).send(`500 Internal Server Error: ${err.code}`);
						});
					}
					else
					{
						res.status(404).sendFile(`${this.directory}404.html`, (err) => {
							if (err)
								res.status(500).type("text/plain").send(`500 Internal Server ERR: ${err.code}`);
						});
					}
				}
				else
					res.status().send(`500 Internal Server Error: ${err.code}`);
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