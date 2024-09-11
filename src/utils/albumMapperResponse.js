const albumMapperResponse = ({
  id,
  name,
  year,
  cover,
}) => ({
  id,
  name,
  year,
  coverUrl: cover,
});

module.exports = { albumMapperResponse };
