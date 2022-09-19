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

	isBocal()
	{
		if (this.raw['staff?'] || this.raw['id'] == '93179')
			return true;
		else
			return false;
	}
}

module.exports = auth;