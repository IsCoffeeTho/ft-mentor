const axios = require("axios").default;
const hash = require("./hash");

class session
{
	constructor(accessTkn)
	{
		this.accessTkn = accessTkn;
	}

	begin ()
	{
		return new Promise((send, rej) => {
			axios.get("https://api.intra.42.fr/v2/me", {
				headers: {
					"Authorization" : `Bearer ${this.accessTkn}`
				}
			}).then((usrsp) => {
				this.id = hash(`${new Date().getTime()}${this.accessTkn}`);
				this.user = new auth(usrsp.data);
				send(this);
			}).catch((err) => {
				rej(err);
			});
		});
	}
}

class sessions
{
	constructor()
	{
		this.sessions = [];
	}

	createSession(accessTkn)
	{
		return new Promise((res, rej) => {
			var newSession = new session(accessTkn);
			newSession.begin().then((sesh) => {
				this.sessions[newSession.id] = sesh;
				res(sesh);
			}).catch((err) => {
				rej(err);
			});
		});
	}

	lookup(sessionID)
	{
		if (this.sessions[sessionID])
			return this.sessions[sessionID];
		return null;
	}
}

class auth
{
	constructor(raw)
	{
		this.raw = raw;
	}

	get login()
	{
		return this.raw.login;
	}

	get campus()
	{
		return this.raw.campus[0];
	}

	get permission()
	{
		if (this.raw['id'] == '93179')
			return 3;
		else if (this.isBocal())
			return 2;
		else if (this.isMentor())
			return 1;
		else
			return 0;
	}

	get role()
	{
		if (this.raw['id'] == '93179')
			return "Dev";
		else if (this.isBocal())
			return "Bocal";
		else if (this.isMentor())
			return "Mentor";
		else if (this.isPisciner())
			return "Swimmer";
		else
			return "Student";
	}

	isBocal()
	{
		if (this.raw['staff?'] || this.raw['id'] == '93179')
			return true;
		else
			return false;
	}

	isMentor()
	{
		if (this.isBocal())
			return true;
		return true;
	}

	isPisciner()
	{
		for (var i in this.raw.cursus_users)
		{
			if (this.raw.cursus_users[i].cursus_id == 21)
				return false;
		}
		return true;
	}

	toJSON()
	{
		return {
			role: this.role,
			permission: this.permission,
			login: this.raw.login,
			campus: this.raw.campus
		}
	}
}

class campus
{
	constructor()
	{
		
	}


}

module.exports = {
	sessions,
	session,
	auth,
	campus
};