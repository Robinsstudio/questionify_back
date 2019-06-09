const mongoose = require('mongoose');
const ObjectId = mongoose.Schema.Types.ObjectId;

mongoose.connect('mongodb://localhost:27017/questionify', { useNewUrlParser: true });

const Question = mongoose.model('Question', {
	type: String,
	name: String,
	label: String,
	tags: [{ type: String }],
	answers: [{
		label: String,
		correct: Boolean
	}],
	idParent: ObjectId
});

const MultipleChoice  = mongoose.model('MultipleChoice', {
	type: String,
	name: String,
	questions: [{ idQuestion: ObjectId }],
	url: String,
	sessions: [{
		name: String,
		questions: [{
			label: String,
			answers: [{
				label: String,
				checked: Boolean,
				correct: Boolean
			}]
		}]
	}],
	idParent: ObjectId
});

const Folder = mongoose.model('Folder', {
	type: String,
	name: String,
	idParent: ObjectId
});

const getById = (_id) => {
	return Promise.all([ Folder.findById(_id), Question.findById(_id), MultipleChoice.findById(_id) ]).then(result => result[0] || result[1] || result[2]);
}

const getByParams = (params) => {
	return Promise.all([ Folder.find(params), Question.find(params), MultipleChoice.find(params) ]).then(result => {
		const folders = result[0].sort((file1, file2) => file1.name.localeCompare(file2.name));
		const files = result[1].concat(result[2]).sort((file1, file2) => file1.name.localeCompare(file2.name));
		return folders.concat(files);
	});
}

const getParents = (folder) => {
	return folder.idParent ? Folder.findOne({ _id: folder.idParent }).then(fold => {
		return fold.idParent ? getParents(fold).then(parents => parents.concat(fold)) : [fold];
	}) : Promise.resolve([]);
};

const deleteRecursive = (_id) => {
	return Folder.find({ idParent: _id }).then(folders => Promise.all(folders.map(folder => deleteRecursive(folder)))).then(() => {
		return Promise.all([ Folder.deleteMany({ idParent: _id }), Question.deleteMany({ idParent: _id }), MultipleChoice.deleteMany({ idParent: _id }) ]);
	});
}

const getQuestionsByIds = (_ids) => {
	return Question.where('_id').in(_ids).then(questions => {
		return questions.sort((q1, q2) => _ids.indexOf(q1.id) - _ids.indexOf(q2.id));
	});
};

const getQuestionsByIdsWithoutAnswers = (_ids) => {
	return Question.where('_id').in(_ids).select('label answers.label -_id').then(questions => {
		return questions.sort((q1, q2) => _ids.indexOf(q1.id) - _ids.indexOf(q2.id));
	});
};

module.exports = {
	createFolder: (folderData) => {
		return new Folder({ ...folderData, type: 'folder' }).save();
	},

	listFolder: (_id) => {
		if (_id) {
			return Folder.findById(_id).then(folder => {
				return Promise.all([
					folder,
					getParents(folder),
					getByParams({ idParent: folder._id })
				]);
			}).then(([folder, parents, files]) => {
				return { folder: { path: parents, active: folder }, files };
			});
		}
		return getByParams({ idParent: null }).then(files => {
			return { folder: { path: [], active: {} }, files };
		});
	},

	getQuestionsByIds,

	getQuestionsByTags: (tags, idParent) => {
		return Question.find({ idParent }).where('tags').all(tags).then(questions => {
			return questions.sort((q1, q2) => q1.name.localeCompare(q2.name));
		});
	},

	getTagsStartingWith: (start) => {
		const regex = new RegExp(eval(`/^${start}/i`));
		return Question.distinct('tags').then(tags => tags.filter(tag => tag.match(regex)).sort());
	},

	rename: (_id, name) => {
		return getById(_id).then(file => {
			file.name = name;
			file.save();
		});
	},

	delete: (_id) => {
		return Promise.all([
			deleteRecursive(_id),
			Folder.deleteOne({ _id }),
			Question.deleteOne({ _id }),
			MultipleChoice.deleteOne({ _id })
		]);
	},

	saveQuestion: (questionData) => {
		if (questionData._id) {
			return Question.findOneAndUpdate({ _id: questionData._id }, questionData, { upsert: true });
		} else {
			return new Question(questionData).save();
		}
	},

	saveMultipleChoice: (multipleChoiceData) => {
		if (multipleChoiceData._id) {
			return MultipleChoice.findOneAndUpdate({ _id: multipleChoiceData._id }, multipleChoiceData, { upsert: true });
		} else {
			return new MultipleChoice(multipleChoiceData).save();
		}
	},

	generateLink: (_id) => {
		return MultipleChoice.findById(_id).then(multipleChoice => {
			multipleChoice.url = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
			return multipleChoice.save();
		});
	},

	getByLink: (url) => {
		return MultipleChoice.find({ url }).then(multipleChoices => {
			if (multipleChoices.length) {
				return getQuestionsByIdsWithoutAnswers(multipleChoices[0].questions.map(quest => quest.idQuestion));
			}
			return Promise.resolve([]);
		});
	},

	saveSession: (url, session) => {
		return MultipleChoice.find({ url }).then(multipleChoices => {
			if (multipleChoices.length) {
				const multipleChoice = multipleChoices[0];
				return getQuestionsByIds(multipleChoice.questions.map(q => q.idQuestion)).then(questions => {
					session.questions.forEach((question, i) => {
						question.answers.forEach((answer, j) => {
							answer.correct = questions[i].answers[j].correct;
						});
					});
					multipleChoice.sessions = multipleChoice.sessions || [];
					multipleChoice.sessions = multipleChoice.sessions.concat(session);
					multipleChoice.save();
					return session.questions;
				});
			}
			return Promise.resolve();
		});
	}
}