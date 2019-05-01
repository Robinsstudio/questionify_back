const app = require('express')();
const bodyParser = require('body-parser');
const http = require('http').Server(app);
const Impl = require('./impl');

app.use(bodyParser.json());

app.post(/CreateFolder/, (req, res) => {
	const folderData = req.body;
	Impl.createFolder(folderData).then( () => res.status(200).end() );
});

app.post(/ListFolder/, (req, res) => {
	const { _id } = req.body;
	Impl.listFolder(_id).then(json => res.json(json));
});

app.post(/GetQuestionsByIds/, (req, res) => {
	const { _ids } = req.body;
	Impl.getQuestionsByIds(_ids).then(questions => res.json(questions));
});

app.post(/GetQuestionsByTags/, (req, res) => {
	const { tags, idParent } = req.body;
	Impl.getQuestionsByTags(tags, idParent).then(questions => res.json(questions));
});

app.post(/GetTagsStartingWith/, (req, res) => {
	const { start } = req.body;
	Impl.getTagsStartingWith(start).then(tags => res.json(tags));
});

app.post(/Rename/, (req, res) => {
	const { _id, name } = req.body;
	Impl.rename(_id, name).then( () => res.status(200).end() );
});

app.post(/Delete/, (req, res) => {
	const { _id } = req.body;
	Impl.delete(_id).then(() => res.status(200).end());
});

app.post(/SaveQuestion/, (req, res) => {
	const questionData = { ...req.body, type: 'question'};
	Impl.saveQuestion(questionData).then( () => res.status(200).end() );
});

app.post(/SaveMultipleChoice/, (req, res) => {
	const multipleChoiceData = { ...req.body, type: 'qcm'};
	Impl.saveMultipleChoice(multipleChoiceData).then( () => res.status(200).end() );
});

http.listen(8080);